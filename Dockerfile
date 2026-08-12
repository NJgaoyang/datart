FROM eclipse-temurin:17-jre
LABEL "author"="tl"
RUN mkdir /datart
COPY ./bin/ /datart/bin/
COPY ./config/ /datart/config/
COPY ./lib/ /datart/lib/
COPY static /datart/static
ENV TZ=Asia/Shanghai
ENV JAVA_XMS=512m
ENV JAVA_XMX=2g
EXPOSE 8080
WORKDIR /datart
ENTRYPOINT java -server -Xms${JAVA_XMS} -Xmx${JAVA_XMX} -Dspring.profiles.active=config -Dspring.config.additional-location=file:./config/profiles/ -Dfile.encoding=UTF-8 -cp "lib/*" datart.DatartServerApplication