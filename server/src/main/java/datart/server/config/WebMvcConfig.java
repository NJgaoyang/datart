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

package datart.server.config;

import com.alibaba.fastjson2.JSONWriter;
import com.alibaba.fastjson2.support.config.FastJsonConfig;
import com.alibaba.fastjson2.support.spring6.http.converter.FastJsonHttpMessageConverter;
import datart.server.config.interceptor.BasicValidRequestInterceptor;
import datart.server.config.interceptor.LoginInterceptor;
import datart.server.config.interceptor.RateLimitInterceptor;
import datart.server.controller.BaseController;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.PathMatchConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Value("${datart.server.path-prefix}")
    private String pathPrefix;

    private final LoginInterceptor loginInterceptor;

    private final RateLimitInterceptor rateLimitInterceptor;

    public WebMvcConfig(LoginInterceptor loginInterceptor, RateLimitInterceptor rateLimitInterceptor) {
        this.loginInterceptor = loginInterceptor;
        this.rateLimitInterceptor = rateLimitInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        String prefix = getPathPrefix();
        // 限流拦截器优先于登录拦截器执行：对认证类公开接口按 IP 限流，防暴力破解/滥用
        registry.addInterceptor(rateLimitInterceptor).addPathPatterns(
                prefix + "/users/login",
                prefix + "/users/reset/password",
                prefix + "/users/forget/password",
                prefix + "/users/register",
                prefix + "/users/sendmail"
        );
        registry.addInterceptor(loginInterceptor).addPathPatterns(prefix + "/**");
        //i18n locale interceptor
        registry.addInterceptor(new BasicValidRequestInterceptor()).addPathPatterns("/**");
    }

    //Add request url prefix
    @Override
    public void configurePathMatch(PathMatchConfigurer configurer) {
        configurer.addPathPrefix(getPathPrefix(), aClass -> aClass.getSuperclass().equals(BaseController.class));
    }

    public String getPathPrefix() {
        return StringUtils.removeEnd(pathPrefix, "/");
    }

    @Override
    public void configureMessageConverters(List<HttpMessageConverter<?>> converters) {
        FastJsonHttpMessageConverter fastConverter = new FastJsonHttpMessageConverter();
        FastJsonConfig fastJsonConfig = new FastJsonConfig();
        fastJsonConfig.setWriterFeatures(JSONWriter.Feature.WriteMapNullValue,
                JSONWriter.Feature.ReferenceDetection);
        fastConverter.setFastJsonConfig(fastJsonConfig);
        converters.add(0, fastConverter);
    }
}