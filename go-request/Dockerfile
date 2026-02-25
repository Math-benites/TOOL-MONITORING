FROM golang:1.22-alpine AS build

WORKDIR /app
COPY go.mod ./
RUN go mod download

COPY . .
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /bin/go-request ./main.go

FROM alpine:3.20
RUN apk add --no-cache curl
RUN adduser -D -g '' appuser
WORKDIR /app
COPY --from=build /bin/go-request /usr/local/bin/go-request
USER appuser
EXPOSE 8080
ENTRYPOINT ["go-request"]
