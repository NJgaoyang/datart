package datart.server.controller;

import datart.core.base.annotations.SkipLogin;
import datart.core.base.consts.Const;
import datart.core.entity.User;
import datart.security.util.JwtUtils;
import datart.server.base.dto.ResponseData;
import datart.server.base.params.WechatMiniAppTokenParam;
import datart.server.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestRedirectFilter;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;

@Tag(name = "Third Party Auth")
@Slf4j
@RestController
@RequestMapping(value = "/tpa")
public class ThirdPartyAuthController extends BaseController {

    private final UserService userService;

    public ThirdPartyAuthController(UserService userService) {
        this.userService = userService;
    }

    private ClientRegistrationRepository clientRegistrationRepository;

    @Value("${datart.tpa.wechat-mini-app.timestamp-tolerance-seconds:300}")
    private long wechatMiniAppTimestampToleranceSeconds;

    @Value("${datart.tpa.wechat-mini-app.web-base-url:}")
    private String wechatMiniAppWebBaseUrl;

    @Operation(summary = "Get Oauth2 clents")
    @GetMapping(value = "getOauth2Clients", consumes = MediaType.ALL_VALUE, produces = MediaType.APPLICATION_JSON_UTF8_VALUE)
    @SkipLogin
    public ResponseData<List<HashMap<String, String>>> getOauth2Clients(HttpServletRequest request) {
        if (clientRegistrationRepository == null) {
            return ResponseData.success(Collections.emptyList());
        }
        Iterable<ClientRegistration> clientRegistrations = (Iterable<ClientRegistration>) clientRegistrationRepository;
        List<HashMap<String, String>> clients = new ArrayList<>();
        clientRegistrations.forEach(registration -> {
            HashMap<String, String> map = new HashMap<>();
            map.put(registration.getClientName(), OAuth2AuthorizationRequestRedirectFilter.DEFAULT_AUTHORIZATION_REQUEST_BASE_URI + "/" + registration.getRegistrationId() + "?redirect_url=/");
            clients.add(map);
        });

        return ResponseData.success(clients);
    }

    @Operation(summary = "Get Datart token for WeChat mini app")
    @PostMapping(value = "wechat-mini-app/token", consumes = MediaType.APPLICATION_JSON_UTF8_VALUE, produces = MediaType.APPLICATION_JSON_UTF8_VALUE)
    @SkipLogin
    public ResponseData<String> getWechatMiniAppToken(@Validated @RequestBody WechatMiniAppTokenParam tokenParam,
                                                      HttpServletResponse response) {
        String token = createWechatMiniAppToken(tokenParam);
        if (StringUtils.isBlank(token)) {
            return ResponseData.failure("权限不足");
        }
        response.setHeader(Const.TOKEN, token);
        return ResponseData.success(StringUtils.removeStart(token, Const.TOKEN_HEADER_PREFIX));
    }

    @Operation(summary = "Get Datart url for WeChat mini app")
    @PostMapping(value = "wechat-mini-app/url", consumes = MediaType.APPLICATION_JSON_UTF8_VALUE, produces = MediaType.APPLICATION_JSON_UTF8_VALUE)
    @SkipLogin
    public ResponseData<String> getWechatMiniAppUrl(@Validated @RequestBody WechatMiniAppTokenParam tokenParam,
                                                    HttpServletRequest request,
                                                    HttpServletResponse response,
                                                    @RequestHeader(value = "X-Forwarded-Proto", required = false) String forwardedProto,
                                                    @RequestHeader(value = "X-Forwarded-Host", required = false) String forwardedHost) {
        String token = createWechatMiniAppToken(tokenParam);
        if (StringUtils.isBlank(token)) {
            return ResponseData.failure("权限不足");
        }
        response.setHeader(Const.TOKEN, token);
        return ResponseData.success(buildWechatMiniAppUrl(
                StringUtils.removeStart(token, Const.TOKEN_HEADER_PREFIX),
                tokenParam.getRedirectUrl(),
                request,
                forwardedProto,
                forwardedHost));
    }

    @Autowired(required = false)
    public void setClientRegistrationRepository(ClientRegistrationRepository clientRegistrationRepository) {
        this.clientRegistrationRepository = clientRegistrationRepository;
    }

    private String createWechatMiniAppToken(WechatMiniAppTokenParam tokenParam) {
        if (!validWechatMiniAppRequest(tokenParam)) {
            return "";
        }
        User user = userService.getUserByName(tokenParam.getMobile());
        if (user == null || !Boolean.TRUE.equals(user.getActive())) {
            return "";
        }
        return JwtUtils.toJwtString(JwtUtils.createJwtToken(user));
    }

    private boolean validWechatMiniAppRequest(WechatMiniAppTokenParam tokenParam) {
        if (StringUtils.isAnyBlank(tokenParam.getMobile(), tokenParam.getTimestamp(), tokenParam.getSign())) {
            return false;
        }
        if (!validTimestamp(tokenParam.getTimestamp())) {
            return false;
        }
        String expectedSign = sha256Hex(tokenParam.getMobile() + "\n" + tokenParam.getTimestamp());
        return MessageDigest.isEqual(
                expectedSign.getBytes(StandardCharsets.UTF_8),
                tokenParam.getSign().toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8));
    }

    private boolean validTimestamp(String timestamp) {
        try {
            long requestTime = Long.parseLong(timestamp);
            if (String.valueOf(Math.abs(requestTime)).length() == 10) {
                requestTime = requestTime * 1000;
            }
            long diff = Math.abs(System.currentTimeMillis() - requestTime);
            return diff <= wechatMiniAppTimestampToleranceSeconds * 1000;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private String sha256Hex(String data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder sign = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                sign.append(String.format("%02x", b));
            }
            return sign.toString();
        } catch (NoSuchAlgorithmException e) {
            log.warn("Wechat mini app sign calculation failed", e);
            return "";
        }
    }

    private String buildWechatMiniAppUrl(String rawToken,
                                         String redirectUrl,
                                         HttpServletRequest request,
                                         String forwardedProto,
                                         String forwardedHost) {
        UriComponentsBuilder builder = UriComponentsBuilder
                .fromHttpUrl(getWechatMiniAppBaseUrl(request, forwardedProto, forwardedHost))
                .path("/authorization")
                .queryParam("authorization_token", rawToken);

        if (isSafeRedirectUrl(redirectUrl)) {
            builder.queryParam("redirect_url", redirectUrl);
        }
        return builder.build().encode().toUriString();
    }

    private String getWechatMiniAppBaseUrl(HttpServletRequest request,
                                           String forwardedProto,
                                           String forwardedHost) {
        if (StringUtils.isNotBlank(wechatMiniAppWebBaseUrl)) {
            return StringUtils.removeEnd(wechatMiniAppWebBaseUrl.trim(), "/");
        }
        if (StringUtils.isNotBlank(forwardedHost)) {
            String proto = StringUtils.defaultIfBlank(forwardedProto, request.getScheme());
            return proto + "://" + forwardedHost;
        }
        StringBuilder baseUrl = new StringBuilder();
        baseUrl.append(request.getScheme()).append("://").append(request.getServerName());
        int port = request.getServerPort();
        if (port > 0 && port != 80 && port != 443) {
            baseUrl.append(":").append(port);
        }
        return baseUrl.toString();
    }

    private boolean isSafeRedirectUrl(String redirectUrl) {
        return StringUtils.isNotBlank(redirectUrl)
                && redirectUrl.startsWith("/")
                && !redirectUrl.startsWith("//");
    }
}
