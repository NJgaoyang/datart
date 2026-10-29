package datart.server.config.interceptor;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;

class RateLimitInterceptorTest {

    @Test
    void ignoresSpoofedForwardingHeadersFromUntrustedPeers() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("203.0.113.20");
        request.addHeader("X-Forwarded-For", "192.0.2.10");
        request.addHeader("X-Real-IP", "192.0.2.11");

        assertEquals("203.0.113.20",
                RateLimitInterceptor.resolveClientIp(request, "127.0.0.1,::1"));
    }

    @Test
    void usesNearestUntrustedHopFromLocalReverseProxy() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");
        // Attacker-supplied value on the left must not override the proxy's
        // appended actual client address on the right.
        request.addHeader("X-Forwarded-For", "192.0.2.99, 198.51.100.12");

        assertEquals("198.51.100.12",
                RateLimitInterceptor.resolveClientIp(request, "127.0.0.1,::1"));
    }

    @Test
    void supportsExplicitTrustedProxyHops() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");
        request.addHeader("X-Forwarded-For", "198.51.100.12, 10.0.0.8");

        assertEquals("198.51.100.12",
                RateLimitInterceptor.resolveClientIp(request, "127.0.0.1,10.0.0.8"));
    }

    @Test
    void fallsBackToRemoteWhenProxyHeadersAreMissingOrMalformed() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");
        request.addHeader("X-Forwarded-For", "not-an-ip");
        request.addHeader("X-Real-IP", "also-invalid");

        assertEquals("127.0.0.1",
                RateLimitInterceptor.resolveClientIp(request, "127.0.0.1,::1"));
    }

    @Test
    void usesRealIpOnlyForTrustedProxies() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("::1");
        request.addHeader("X-Real-IP", "2001:db8::5");

        assertEquals("2001:db8::5",
                RateLimitInterceptor.resolveClientIp(request, "127.0.0.1,::1"));
    }
}
