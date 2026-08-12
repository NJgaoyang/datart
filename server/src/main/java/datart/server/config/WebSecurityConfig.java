package datart.server.config;

import datart.security.oauth2.ClientRegistrationRepositoryImpl;
import datart.security.oauth2.CustomOAuth2AuthorizationRequestRedirectFilter;
import datart.security.oauth2.CustomOauth2AuthenticationFilter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.security.oauth2.client.OAuth2ClientProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestRedirectFilter;
import org.springframework.security.oauth2.client.web.OAuth2LoginAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;

import static datart.core.common.Application.getApiPrefix;

@Configuration
@EnableWebSecurity
@Slf4j
public class WebSecurityConfig {

    @Value("${datart.security.content-security-policy:default-src 'self'; img-src 'self' data: blob: https: http:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; worker-src 'self' blob:; connect-src 'self' ws: wss:; frame-ancestors 'self'}")
    private String contentSecurityPolicy;

    private OAuth2ClientProperties oAuth2ClientProperties;

    private Oauth2AuthenticationSuccessHandler authenticationSuccessHandler;

    private Oauth2AuthenticationFailureHandler authenticationFailureHandler;

    private ClientRegistrationRepositoryImpl clientRegistrations;

    @Bean
    public WebSecurityCustomizer webSecurityCustomizer() {
        return web -> web.ignoring().requestMatchers(getApiPrefix() + "/tpa/**");
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable);
        http.headers(headers -> headers
                .contentTypeOptions(contentTypeOptions -> {})
                .referrerPolicy(referrerPolicy -> referrerPolicy
                        .policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.SAME_ORIGIN))
                .contentSecurityPolicy(csp -> csp
                        .policyDirectives(contentSecurityPolicy))
                .frameOptions(frameOptions -> frameOptions.sameOrigin())
                .httpStrictTransportSecurity(hsts -> hsts
                        .includeSubDomains(true)
                        .maxAgeInSeconds(31536000))
        );
        if (this.oAuth2ClientProperties != null) {
            http.addFilterBefore(new CustomOAuth2AuthorizationRequestRedirectFilter(clientRegistrations), OAuth2AuthorizationRequestRedirectFilter.class);
            http.addFilterBefore(new CustomOauth2AuthenticationFilter(clientRegistrations, authenticationSuccessHandler), OAuth2LoginAuthenticationFilter.class);
            http.oauth2Login(oauth2 -> oauth2
                    .failureHandler(authenticationFailureHandler)
                    .clientRegistrationRepository(clientRegistrations)
                    .successHandler(authenticationSuccessHandler)
                    .loginPage("/")
            );
            http.authorizeHttpRequests(auth -> auth
                    .requestMatchers(getApiPrefix() + "/tpa/**").permitAll()
                    .anyRequest().permitAll()
            );
            http.logout(logout -> logout
                    .logoutUrl("/tpa/oauth2/logout")
                    .permitAll()
            );
        }
        return http.build();
    }

    @Autowired(required = false)
    public void setoAuth2ClientProperties(OAuth2ClientProperties properties) {
        this.oAuth2ClientProperties = properties;
    }

    @Autowired
    public void setAuthenticationSuccessHandler(Oauth2AuthenticationSuccessHandler authenticationSuccessHandler) {
        this.authenticationSuccessHandler = authenticationSuccessHandler;
    }

    @Autowired
    public void setClientRegistrations(ClientRegistrationRepositoryImpl clientRegistrations) {
        this.clientRegistrations = clientRegistrations;
    }

    @Autowired
    public void setAuthenticationFailureHandler(Oauth2AuthenticationFailureHandler authenticationFailureHandler) {
        this.authenticationFailureHandler = authenticationFailureHandler;
    }
}
