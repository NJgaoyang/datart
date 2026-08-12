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

package datart.security.oauth2;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONObject;
import datart.core.base.exception.Exceptions;
import datart.core.common.Application;
import datart.security.util.AESUtil;
import datart.security.util.SecurityUtils;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.utils.URIBuilder;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.util.EntityUtils;
import org.springframework.boot.autoconfigure.security.oauth2.client.OAuth2ClientProperties;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Collections;
import java.util.HashMap;

@Slf4j
public class WeChartOauth2Client implements CustomOauth2Client {

    private static final HttpClient httpClient;

    static {
        httpClient = HttpClientBuilder.create().build();
    }

    public static final String REGISTRATION_ID = "wechat";

    private static final String authorizationUri = "https://open.weixin.qq.com/connect/qrconnect";

    private static final String tokenUri = "https://api.weixin.qq.com/sns/oauth2/access_token";

    private static final String userInfoUri = "https://api.weixin.qq.com/sns/userinfo";

    private static final String redirectUri = "/login/oauth2/code/" + REGISTRATION_ID;

    private final ClientRegistration clientRegistration;

    public WeChartOauth2Client(ClientRegistration clientRegistration) {
        validateRegistration(clientRegistration);
        this.clientRegistration = clientRegistration;
    }

    @Override
    public void authorizationRequest(HttpServletRequest request, HttpServletResponse response) {
        try {
            URIBuilder uriBuilder = new URIBuilder(authorizationUri);
            uriBuilder.addParameter("scope", "snsapi_login");
            uriBuilder.addParameter("response_type", "code");
            uriBuilder.addParameter("lang", "cn");
            uriBuilder.addParameter("appid", clientRegistration.getClientId());
            uriBuilder.addParameter("state", AESUtil.encrypt(SecurityUtils.randomPassword(8)));
            uriBuilder.addParameter("redirect_uri", getRedirectUrl());
            response.sendRedirect(uriBuilder.build().toString());
        } catch (Exception e) {
            log.error("Failed to redirect to WeChat authorization page", e);
        }
    }

    private String getRedirectUrl() {
        String url = Application.getProperty("spring.security.oauth2.client.registration.wechart.call-back-url");
        if (StringUtils.isBlank(url)) {
            url = Application.getServerPrefix();
        }
        url = StringUtils.removeEnd(url, "/");
        url = url + redirectUri;
        return url;
    }

    private void validateRegistration(ClientRegistration clientRegistration) {
    }

    @Override
    public OAuth2AuthenticationToken getUserInfo(HttpServletRequest request, HttpServletResponse response) {
        try {
            String code = request.getParameter("code");
            String state = request.getParameter("state");
            try {
                String decrypt = AESUtil.decrypt(state);
            } catch (Exception e) {
                Exceptions.msg("Failed to verify the state parameter");
            }
            String accessToken = getAccessToken(code);
            return getUserinfo(accessToken);
        } catch (Exception e) {
            log.error("Failed to get WeChat user info", e);
        }
        return null;
    }

    public static void addClientRegistration(OAuth2ClientProperties properties) {
        if (properties == null) {
            return;
        }
        if (properties.getRegistration().containsKey(REGISTRATION_ID)) {
            properties.getProvider()
                    .put(REGISTRATION_ID, creatProvider());
            OAuth2ClientProperties.Registration registration = properties.getRegistration().get(REGISTRATION_ID);
            registration.setAuthorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE.getValue());
            try {
                registration.setRedirectUri(redirectUri);
            } catch (Exception e) {
                log.error("Failed to set WeChat redirect URI", e);
            }
        }
    }


    private static OAuth2ClientProperties.Provider creatProvider() {
        OAuth2ClientProperties.Provider provider = new OAuth2ClientProperties.Provider();
        provider.setTokenUri(tokenUri);
        provider.setUserInfoUri(userInfoUri);
        provider.setAuthorizationUri(authorizationUri);
        return provider;
    }

    private String getAccessToken(String code) throws Exception {
        HttpGet httpRequest = new HttpGet();
        URIBuilder uriBuilder = new URIBuilder(tokenUri);
        uriBuilder.addParameter("grant_type", "authorization_code");
        uriBuilder.addParameter("appid", clientRegistration.getClientId());
        uriBuilder.addParameter("secret", clientRegistration.getClientSecret());
        uriBuilder.addParameter("code", code);
        httpRequest.setURI(uriBuilder.build());
        HttpResponse response = httpClient.execute(httpRequest);
        String entity = EntityUtils.toString(response.getEntity());
        JSONObject jsonObject = JSON.parseObject(entity);
        return jsonObject.getString("access_token");
    }

    private OAuth2AuthenticationToken getUserinfo(String accessToken) throws Exception {
        HttpGet httpRequest = new HttpGet();
        URIBuilder uriBuilder = new URIBuilder(userInfoUri);
        uriBuilder.addParameter("access_token", accessToken);
        uriBuilder.addParameter("scope", "snsapi_userinfo");
        httpRequest.setURI(uriBuilder.build());
        HttpResponse response = httpClient.execute(httpRequest);
        String entity = EntityUtils.toString(response.getEntity());
        JSONObject jsonObject = JSON.parseObject(entity);

        HashMap<String, Object> attributes = new HashMap<>();
        attributes.put(CustomOauth2Client.NAME, jsonObject.getString("nickname"));
        attributes.put(CustomOauth2Client.EMAIL, jsonObject.getString("email"));
        attributes.put(CustomOauth2Client.AVATAR, jsonObject.getString("headimgurl"));
        DefaultOAuth2User auth2User = new DefaultOAuth2User(Collections.emptyList(), attributes, CustomOauth2Client.NAME);
        return new OAuth2AuthenticationToken(auth2User, Collections.emptyList(), REGISTRATION_ID);
    }


}
