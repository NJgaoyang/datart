package datart.security.util;

import com.google.common.collect.Lists;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.source.RemoteJWKSet;
import datart.core.base.exception.Exceptions;
import io.jsonwebtoken.*;
import lombok.extern.slf4j.Slf4j;
import org.bouncycastle.asn1.pkcs.PrivateKeyInfo;
import org.bouncycastle.asn1.x509.SubjectPublicKeyInfo;
import org.bouncycastle.jcajce.provider.asymmetric.ec.BCECPrivateKey;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.jce.spec.ECParameterSpec;
import org.bouncycastle.jce.spec.ECPublicKeySpec;
import org.bouncycastle.math.ec.ECPoint;
import org.bouncycastle.openssl.PEMKeyPair;
import org.bouncycastle.openssl.PEMParser;
import org.bouncycastle.openssl.jcajce.JcaPEMKeyConverter;
import org.springframework.util.CollectionUtils;

import java.io.File;
import java.io.FileReader;
import java.net.URL;
import java.security.*;
import java.security.interfaces.ECPrivateKey;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.util.Collections;
import java.util.List;

@Slf4j
public class JwkUtils {

    private static Provider provider = null;

    private static JcaPEMKeyConverter keyConverter = new JcaPEMKeyConverter();

    static {
        if (Security.getProvider("BC") == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
        provider = Security.getProvider("BC");
        keyConverter.setProvider(provider);
    }

    public static Jwt parseJwt(String token, String JwkSetFilePath) {
        List<Key> keys = JwkUtils.getJwKFromFile(JwkSetFilePath);
        Jwt jwt = null;
        for (Key key : keys) {
            try {
                // EC PrivateKey generate PublicKey
                if (key instanceof ECPrivateKey) {
                    key = EcPrivateToPublic((ECPrivateKey) key);
                }
                if (key instanceof PublicKey) {
                    jwt = Jwts.parser().verifyWith((PublicKey) key).build().parseSignedClaims(token);
                } else if (key instanceof SecretKey) {
                    // 对称密钥（oct/HMAC）：用同一密钥验签
                    jwt = Jwts.parser().verifyWith(toHmacKey((SecretKey) key, token)).build().parseSignedClaims(token);
                }
                break;
            } catch (ExpiredJwtException expired) {
                log.info(expired.getMessage());
                break;
            } catch (JwtException ignore) {
                log.warn(ignore.getMessage());
            }
        }
        if (jwt == null) {
            Exceptions.base("Jwt token parse failed");
        }
        return jwt;
    }

    /**
     * nimbus-jose 解析 oct JWK 得到的 SecretKeySpec 算法名可能为 "NONE"，
     * 而 JJWT 0.12 验签要求密钥算法名为合法的 HmacSHA*。此处按 JWT header 的 alg
     * 归一化为对应的 HmacSHA256/384/512（密钥字节不变）。
     */
    private static SecretKey toHmacKey(SecretKey key, String token) {
        String alg = key.getAlgorithm();
        if (alg != null && alg.startsWith("HmacSHA")) {
            return key;
        }
        String jcaAlg = "HmacSHA256";
        try {
            String header = token.substring(0, token.indexOf('.'));
            String json = new String(java.util.Base64.getUrlDecoder().decode(header), java.nio.charset.StandardCharsets.UTF_8);
            if (json.contains("HS512")) {
                jcaAlg = "HmacSHA512";
            } else if (json.contains("HS384")) {
                jcaAlg = "HmacSHA384";
            }
        } catch (Exception ignore) {
        }
        return new SecretKeySpec(key.getEncoded(), jcaAlg);
    }

    public static List<Key> getJwKFromFile(String JwkSetFilePath) {
        List<Key> keys = Lists.newArrayList();
        File file = new File(JwkSetFilePath);
        try {
            JWKSet jwkSet = JWKSet.load(file);
            List<JWK> jwkList = jwkSet.getKeys();
            keys = KeyConverter.toJavaKeys(jwkList);
        } catch (Exception e) {
            log.error("Failed to load jwkSet from file: "+ file.getPath());
        }
        return keys;
    }

    public static Key getJwKFromFileByKid(String JwkSetFilePath, String kid) {
        Key key = null;
        File file = new File(JwkSetFilePath);
        try {
            JWKSet jwkSet = JWKSet.load(file);
            JWK jwk = jwkSet.getKeyByKeyId(kid);
            List<Key> keys = KeyConverter.toJavaKeys(Collections.singletonList(jwk));
            if (!CollectionUtils.isEmpty(keys)) {
                key = keys.get(0);
            } else {
                log.error("Cannot find jwk from file({}) by kid:({}).",file.getPath(), kid);
            }
        } catch (Exception e) {
            log.error("Failed to load jwkSet from file({}) by kid:({}).",file.getPath(), kid);
        }
        return key;
    }

    public static List<Key> getJwKFromUrl(String jwkSetUrl) {
        List<Key> keys = Lists.newArrayList();
        try {
            RemoteJWKSet remoteJWKSet = new RemoteJWKSet(new URL(jwkSetUrl));
            JWKMatcher jwkMatcher = (new JWKMatcher.Builder()).keyUses(KeyUse.SIGNATURE, KeyUse.ENCRYPTION, null).keyTypes(KeyType.OCT, KeyType.RSA, KeyType.EC).build();
            JWKSelector jwsKeySelector = new JWKSelector(jwkMatcher);
            List list = remoteJWKSet.get(jwsKeySelector, null);
            keys = KeyConverter.toJavaKeys(list);
        } catch (Exception e) {
            log.error("Failed to load jwkSet from url: "+ jwkSetUrl);
        }
        return keys;
    }

    public static Key getJwKFromUrlByKid(String jwkSetUrl, String kid) {
        Key key = null;
        try {
            RemoteJWKSet set = new RemoteJWKSet(new URL(jwkSetUrl));
            JWKSet cachedJWKSet = set.getCachedJWKSet();
            JWK jwk = cachedJWKSet.getKeyByKeyId(kid);
            List<Key> keys = KeyConverter.toJavaKeys(Collections.singletonList(jwk));
            if (!CollectionUtils.isEmpty(keys)) {
                key = keys.get(0);
            } else {
                log.error("Cannot find jwk from url({}) by kid:({}).",jwkSetUrl, kid);
            }
        } catch (Exception e) {
            log.error("Failed to load jwkSet from url({}) by kid:({}).",jwkSetUrl, kid);
        }
        return key;
    }

    public static Key getPublicKeyFromPem(String path) {
        Key key = null;
        try {
            PEMParser pemParser = new PEMParser(new FileReader(path));
            Object keyObj = pemParser.readObject();
            if (keyObj instanceof PEMKeyPair) {
                PEMKeyPair pemKeyPair = (PEMKeyPair) keyObj;
                KeyPair keyPair = keyConverter.getKeyPair(pemKeyPair);
                key = keyPair.getPublic();
            } else if (keyObj instanceof SubjectPublicKeyInfo) {
                SubjectPublicKeyInfo publicKeyInfo = ((SubjectPublicKeyInfo) keyObj);
                key = keyConverter.getPublicKey(publicKeyInfo);
            } else if (keyObj instanceof PrivateKeyInfo) {
                PrivateKeyInfo privateKeyInfo = ((PrivateKeyInfo) keyObj);
                PrivateKey privateKey = keyConverter.getPrivateKey(privateKeyInfo);
                key = privateKey;
                // EC PrivateKey generate PublicKey
                if (privateKey instanceof BCECPrivateKey) {
                    key = EcPrivateToPublic((BCECPrivateKey) privateKey);
                }
            }
        } catch (Exception e) {
            log.error("The pem file parsed failed: {}", e.getMessage());
        }
        return key;
    }

    public static Key getPrivateKeyFromPem(String path) {
        Key key = null;
        try {
            PEMParser pemParser = new PEMParser(new FileReader(path));
            Object keyObj = pemParser.readObject();
            if (keyObj instanceof PEMKeyPair) {
                PEMKeyPair pemKeyPair = (PEMKeyPair) keyObj;
                KeyPair keyPair = keyConverter.getKeyPair(pemKeyPair);
                key = keyPair.getPrivate();
            } else if (keyObj instanceof PrivateKeyInfo) {
                PrivateKeyInfo privateKeyInfo = ((PrivateKeyInfo) keyObj);
                key = keyConverter.getPrivateKey(privateKeyInfo);
            }
        } catch (Exception e) {
            log.error("The pem file parsed failed: {}", e.getMessage());
        }
        return key;
    }

    private static PublicKey EcPrivateToPublic(ECPrivateKey ecPrivateKey){
        try {
            KeyFactory keyFactory = KeyFactory.getInstance("ECDSA");
            BCECPrivateKey privateKey = new BCECPrivateKey(ecPrivateKey, null);
            ECParameterSpec ecSpec = privateKey.getParameters();
            ECPoint ecPoint = ecSpec.getG().multiply(privateKey.getD());
            return keyFactory.generatePublic(new ECPublicKeySpec(ecPoint, ecSpec));
        } catch (Exception e) {
            log.error("failed to covert ec privateKey to public.");
        }
        return null;
    }
}
