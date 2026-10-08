FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B package

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
RUN groupadd --system foodflow && useradd --system --gid foodflow foodflow
COPY --from=build --chown=foodflow:foodflow /build/target/food-order-demo-0.0.1-SNAPSHOT.jar app.jar
USER foodflow
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
