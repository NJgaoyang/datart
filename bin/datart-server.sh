#!/bin/bash

# Datart
# <p>
# Copyright 2021
# <p>
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# <p>
# http://www.apache.org/licenses/LICENSE-2.0
# <p>
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

BASE_DIR=$(cd "$(dirname "$0")/.."; pwd -P)

echo "working dir ${BASE_DIR}"

cd "${BASE_DIR}"

# 优先使用内嵌 JDK，其次 JAVA_HOME，最后 PATH 中的 java
if [ -x "${BASE_DIR}/jdk/bin/java" ]; then
    JAVA_CMD="${BASE_DIR}/jdk/bin/java"
elif [ -n "${JAVA_HOME}" ] && [ -x "${JAVA_HOME}/bin/java" ]; then
    JAVA_CMD="${JAVA_HOME}/bin/java"
else
    JAVA_CMD="java"
fi
echo "using java: ${JAVA_CMD}"

CLASS_PATH="${BASE_DIR}/lib/*"

START_CLASS="datart.DatartServerApplication"

JAVA_XMS="${JAVA_XMS:-512m}"
JAVA_XMX="${JAVA_XMX:-2g}"

datart_status(){
    #result=`ps -ef | awk '/DatartServerApplication/ && !/awk/{print $2}' | wc -l`
    result=`ps -ef | grep -v grep | grep "${BASE_DIR}/lib" | grep 'DatartServerApplication' | awk {'print $2'} | wc -l`

    if [[ $result -eq 0 ]]; then
        return 0
    else
        return 1
    fi
    }

datart_start(){
    source ~/.bashrc
    datart_status >/dev/null 2>&1
    if [[ $? -eq 0 ]]; then

        nohup  ${JAVA_CMD} -server -Xms${JAVA_XMS} -Xmx${JAVA_XMX} \
          --add-opens java.base/java.lang=ALL-UNNAMED \
          --add-opens java.base/java.lang.reflect=ALL-UNNAMED \
          --add-opens java.base/java.util=ALL-UNNAMED \
          --add-opens java.base/java.io=ALL-UNNAMED \
          --add-opens java.base/java.nio=ALL-UNNAMED \
          --add-opens java.base/java.math=ALL-UNNAMED \
          --add-opens java.base/sun.nio.ch=ALL-UNNAMED \
          --add-opens java.base/sun.security.util=ALL-UNNAMED \
          -Dfastjson2.parser.safeMode=true \
          -Dspring.profiles.active=config -Dspring.config.additional-location=file:./config/profiles/ -Dfile.encoding=UTF-8 -cp "${CLASS_PATH}" "${START_CLASS}" &

    else
        echo ""
        #PID=`ps -ef | awk '/DatartServerApplication/ && !/awk/{print $2}'`
        PID=`ps -ef | grep -v grep | grep "${BASE_DIR}/lib" | grep 'DatartServerApplication' | awk {'print $2'}`
        echo "Datart is Running Now..... PID is ${PID} "
    fi
}


datart_stop(){
    datart_status >/dev/null 2>&1
    if [[ $? -eq 0 ]]; then
        echo ""
        echo "Datart is not Running....."
        echo ""
    else
         #ps -ef | awk '/DatartServerApplication/ && !/awk/{print $2}'| xargs kill -9
         ps -ef | grep -v grep | grep "$BASE_DIR/lib" | grep 'DatartServerApplication' | awk {'print $2'} | xargs kill -9

    fi
}


case $1 in
    start )
        echo ""
        echo "Datart Starting........... "
        echo ""
        datart_start
    ;;

    stop )
        echo ""

        echo "Datart Stopping.......... "

        echo ""
        datart_stop
    ;;

    restart )
        echo "Datart is Restarting.......... "
        datart_stop
        echo ""
        datart_start
        echo "Datart is Starting.......... "

    ;;

    status )
        datart_status>/dev/null 2>&1
        if [[ $? -eq 0 ]]; then
            echo ""
            echo "Datart is not Running......"
            echo ""
        else
            echo ""
            #PID=`ps -ef | awk '/DatartServerApplication/ && !/awk/{print $2}'`
            PID=`ps -ef | grep -v grep | grep "${BASE_DIR}/lib" | grep 'DatartServerApplication' | awk {'print $2'}`
            echo "Datart is Running..... PID is ${PID}"
            echo ""
        fi
     ;;

    * )
        echo "Usage: datart-server.sh (start|stop|status|restart)"

esac
