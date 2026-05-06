# createTree rembg service

배경제거 모델 런타임을 메인 Node.js 서버에서 분리하기 위한 FastAPI 서비스입니다.

## Railway 배포

1. Railway에서 같은 GitHub repo를 새 서비스로 추가합니다.
2. 서비스의 root directory를 `services/rembg-service`로 지정합니다.
3. Dockerfile 기반으로 배포합니다.
4. 배포 URL을 메인 `createtree-platform` 서비스 변수에 연결합니다.

```text
BACKGROUND_REMOVAL_SERVICE_URL=https://your-rembg-service.up.railway.app
```

## API

```text
GET /health
POST /remove-background
```

`POST /remove-background`는 multipart form-data를 받습니다.

```text
image: image file
model: birefnet-general | birefnet-portrait | isnet-general-use | ...
quality: 1.0
```

## 기본 모델 매핑

메인 Node.js 서버는 기존 관리자 설정을 유지합니다.

```text
small  -> isnet-general-use
medium -> birefnet-general
```

환경변수로 조정할 수 있습니다.

```text
BACKGROUND_REMOVAL_MODEL_SMALL=isnet-general-use
BACKGROUND_REMOVAL_MODEL_MEDIUM=birefnet-general
```
