/*
 * Datart
 * <p>
 * Copyright 2021
 * <p>
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * <p>
 * http://www.apache.org/licenses/LICENSE-2.0
 * <p>
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package datart.data.provider;

import datart.core.data.provider.Dataframe;
import datart.core.common.Application;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.codec.binary.Base64;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.HttpEntity;
import org.apache.http.HttpHeaders;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.*;
import org.apache.http.client.utils.URIBuilder;
import org.apache.http.conn.ssl.NoopHostnameVerifier;
import org.apache.http.conn.ssl.SSLConnectionSocketFactory;
import org.apache.http.conn.ssl.TrustSelfSignedStrategy;
import org.apache.http.entity.ContentType;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.ssl.SSLContexts;
import org.springframework.http.HttpMethod;
import org.springframework.util.CollectionUtils;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@Slf4j
public class HttpDataFetcher {

    private static final CloseableHttpClient SECURE_HTTP_CLIENT = HttpClientBuilder.create().build();

    private final HttpRequestParam param;

    public HttpDataFetcher(HttpRequestParam param) {
        this.param = param;
    }

    public Dataframe fetchAndParse() throws IOException, URISyntaxException {

        HttpRequestBase httpRequest = createHttpRequest(param);

        try (CloseableHttpResponse response = getHttpClient().execute(httpRequest)) {
            HttpResponseParser parser;
            try {
                parser = param.getResponseParser().newInstance();
            } catch (Exception e) {
                parser = new ResponseJsonParser();
            }
            return parser.parseResponse(param.getTargetPropertyName(), response, param.getColumns());
        }
    }

    private CloseableHttpClient getHttpClient() {
        if (Boolean.parseBoolean(Application.getProperty("datart.http-data-provider.allow-insecure-tls", "false"))) {
            log.warn("HTTP data provider TLS certificate and hostname verification are disabled");
            return InsecureHttpClientHolder.INSTANCE;
        }
        return SECURE_HTTP_CLIENT;
    }

    private static class InsecureHttpClientHolder {

        private static final CloseableHttpClient INSTANCE = create();

        private static CloseableHttpClient create() {
            try {
                SSLConnectionSocketFactory socketFactory = new SSLConnectionSocketFactory(
                        SSLContexts.custom().loadTrustMaterial(null, new TrustSelfSignedStrategy()).build(),
                        NoopHostnameVerifier.INSTANCE);
                return HttpClientBuilder.create().setSSLSocketFactory(socketFactory).build();
            } catch (Exception e) {
                throw new IllegalStateException("Unable to configure insecure HTTP data provider TLS", e);
            }
        }
    }

    private HttpRequestBase createHttpRequest(HttpRequestParam param) throws URISyntaxException {
        HttpRequestBase httpRequest;
        HttpEntity entity = createHttpEntity(param);
        HttpMethod method = param.getMethod();
        if (HttpMethod.POST.equals(method)) {
            HttpPost httpPost = new HttpPost();
            httpPost.setEntity(entity);
            httpRequest = httpPost;
        } else if (HttpMethod.PUT.equals(method)) {
            HttpPut httpPut = new HttpPut();
            httpPut.setEntity(entity);
            httpRequest = httpPut;
        } else if (HttpMethod.DELETE.equals(method)) {
            httpRequest = new HttpDelete();
        } else {
            httpRequest = new HttpGet();
        }
        RequestConfig config = RequestConfig.custom()
                .setConnectTimeout(param.getTimeout())
                .setConnectionRequestTimeout(param.getTimeout())
                .setSocketTimeout(param.getTimeout())
                .build();

        httpRequest.setConfig(config);

        httpRequest.setURI(createUri(param));

        withHeaders(param, httpRequest);

        if (StringUtils.isNotBlank(param.getUsername()) && StringUtils.isNotBlank(param.getPassword())) {
            String auth = param.getUsername() + ":" + param.getPassword();
            httpRequest.addHeader(HttpHeaders.AUTHORIZATION, "Basic " + Base64.encodeBase64String(auth.getBytes(StandardCharsets.UTF_8)));
        }

        return httpRequest;
    }

    private HttpEntity createHttpEntity(HttpRequestParam param) {
        if (StringUtils.isEmpty(param.getBody())) {
            return null;
        }
        return new StringEntity(param.getBody(), ContentType.parse(param.getContentType()));
    }

    private URI createUri(HttpRequestParam param) throws URISyntaxException {

        URIBuilder uriBuilder = new URIBuilder(param.getUrl());

        if (!CollectionUtils.isEmpty(param.getQueryParam())) {
            for (Map.Entry<String, String> entry : param.getQueryParam().entrySet()) {
                uriBuilder.addParameter(entry.getKey(), entry.getValue());
            }
        }

        return uriBuilder.build();
    }

    private void withHeaders(HttpRequestParam param, HttpRequestBase httpRequest) {
        if (CollectionUtils.isEmpty(param.getHeaders())) return;
        for (Map.Entry<String, String> entry : param.getHeaders().entrySet()) {
            httpRequest.addHeader(entry.getKey(), entry.getValue());
        }
    }


}
