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

package datart.core.common;

import datart.core.base.exception.Exceptions;

import javax.script.Invocable;
import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;
import javax.script.ScriptException;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;

public class JavascriptUtils {

    private static final ScriptEngineManager engineManager = new ScriptEngineManager();

    private static ScriptEngine getEngine() {
        // 优先使用 GraalVM JS（注册名为 Graal.js/js/JavaScript）：JDK 15+ 已移除 Nashorn，
        // GraalVM JS 可在标准 JDK 上运行，且默认沙箱执行、禁用 Java 宿主访问，更安全。
        // 保留 nashorn 作为最后回退（如未来引入独立 nashorn-core）。
        String[] engineNames = {"Graal.js", "graal.js", "js", "JavaScript", "nashorn"};
        for (String engineName : engineNames) {
            ScriptEngine engine = engineManager.getEngineByName(engineName);
            if (engine != null) {
                return engine;
            }
        }
        Exceptions.msg("No JavaScript engine found. Please add the GraalVM JS dependency (org.graalvm.js:js-scriptengine).");
        return null;
    }

    public static Object invoke(Invocable invocable, String functionName, Object... args) throws Exception {
        if (invocable != null) {
            return invocable.invokeFunction(functionName, args);
        }
        return null;
    }

    public static Invocable load(String path) throws IOException, ScriptException {
        InputStream stream = JavascriptUtils.class.getClassLoader().getResourceAsStream(path);
        if (stream == null) {
            Exceptions.notFound(path);
        }
        try (InputStreamReader reader = new InputStreamReader(stream)) {
            ScriptEngine engine = getEngine();
            engine.eval(reader);
            if (engine instanceof Invocable) {
                return (Invocable) engine;
            }
            return null;
        }
    }

}
