# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /workspace/backend
COPY backend/ .

# Build the Spring Boot fat jar (-DskipTests to keep CI fast)
RUN mvn clean package -DskipTests

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app
RUN mkdir -p /app/data

COPY --from=build /workspace/backend/srv/target/backend-exec.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
