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

package datart.server.config.interceptor;

import com.alibaba.fastjson2.JSON;
import datart.server.base.dto.ResponseData;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.util.Arrays;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 认证类接口限流拦截器：基于客户端 IP + 请求路径做固定窗口计数，
 * 防止对登录 / 找回密码 / 注册 / 发送邮件等公开接口进行暴力破解或滥用。
 * 超过阈值时返回 429（Too Many Requests）及统一 JSON 错误结构。
 *
 * 限流状态保存在内存中（单节点维度）；如需集群级限流可替换为 Redis 实现。
 */
@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    /** 限流桶数量上限，超过后触发过期清理，防止恶意大量不同 IP 导致内存膨胀 */
    private static final int MAX_BUCKETS = 100_000;

    private final ConcurrentHashMap<String, Window> buckets = new ConcurrentHashMap<>();

    @Value("${datart.security.rate-limit.enabled:true}")
    private boolean enabled;

    @Value("${datart.security.rate-limit.max-requests:10}")
    private int maxRequests;

    @Value("${datart.security.rate-limit.window-seconds:60}")
    private int windowSeconds;

    // Only these immediate peers may supply client IP headers. Default supports
    // a reverse proxy on the same host; remote proxy addresses must be opted in.
    @Value("${datart.security.rate-limit.trusted-proxies:127.0.0.1,::1}")
    private String trustedProxies;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (!enabled || maxRequests <= 0) {
            return true;
        }
        long now = System.currentTimeMillis();
        if (buckets.size() > MAX_BUCKETS) {
            evictExpired(now);
        }
        String key = getClientIp(request) + ":" + request.getRequestURI();
        if (!isAllowed(key, now)) {
            writeTooManyRequests(response);
            return false;
        }
        return true;
    }

    /**
     * 固定窗口计数：窗口过期则重置，否则累加。compute 保证同一 key 的原子性。
     */
    private boolean isAllowed(String key, long now) {
        long windowMillis = windowSeconds * 1000L;
        Window window = buckets.compute(key, (k, existing) -> {
            if (existing == null || now - existing.start >= windowMillis) {
                return new Window(now, 1);
            }
            existing.count++;
            return existing;
        });
        return window.count <= maxRequests;
    }

    private void evictExpired(long now) {
        long windowMillis = windowSeconds * 1000L;
        buckets.entrySet().removeIf(entry -> now - entry.getValue().start >= windowMillis);
    }

    /**
     * Trust forwarding headers only from configured immediate proxies.
     * Walk X-Forwarded-For from the right (nearest hop) to avoid accepting a
     * client-controlled leftmost value when the proxy appends the real peer.
     * The reverse proxy must append/overwrite forwarding headers, not relay
     * untrusted headers verbatim.
     */
    private String getClientIp(HttpServletRequest request) {
        return resolveClientIp(request, trustedProxies);
    }

    static String resolveClientIp(HttpServletRequest request, String trustedProxies) {
        String remote = request.getRemoteAddr();
        if (!isTrustedProxy(remote, trustedProxies)) {
            return remote;
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (StringUtils.isNotBlank(forwarded)) {
            String[] hops = forwarded.split(",");
            for (int i = hops.length - 1; i >= 0; i--) {
                String candidate = hops[i].trim();
                if (isIpLiteral(candidate) && !isTrustedProxy(candidate, trustedProxies)) {
                    return candidate;
                }
            }
        }
        String realIp = StringUtils.trimToEmpty(request.getHeader("X-Real-IP"));
        return isIpLiteral(realIp) && !isTrustedProxy(realIp, trustedProxies)
                ? realIp : remote;
    }

    private static boolean isTrustedProxy(String ip, String trustedProxies) {
        return ip != null && Arrays.stream(StringUtils.defaultString(trustedProxies).split(","))
                .map(String::trim).anyMatch(ip::equals);
    }

    private static boolean isIpLiteral(String value) {
        return value != null && value.length() >= 3 && value.length() <= 45
                && (value.indexOf('.') >= 0 || value.indexOf(':') >= 0)
                && value.matches("(?i)[0-9a-f.:]+");
    }

    private void writeTooManyRequests(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType("application/json;charset=UTF-8");
        ResponseData<Object> body = ResponseData.builder()
                .success(false)
                .errCode(HttpStatus.TOO_MANY_REQUESTS.value())
                .message("Too many requests, please try again later.")
                .build();
        response.getWriter().write(JSON.toJSONString(body));
    }

    private static final class Window {
        private final long start;
        private int count;

        private Window(long start, int count) {
            this.start = start;
            this.count = count;
        }
    }
}
