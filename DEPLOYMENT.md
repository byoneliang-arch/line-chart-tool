# 部署指南

这个项目已经支持两种部署方式：

1. 单机 Docker 部署，推荐给新手和 VPS。
2. 手动部署，把 Vue 打包结果交给 Flask/Gunicorn 托管。

生产模式下，前端和后端会合并成一个 Web 服务：

- 页面访问：`http://服务器地址:5001/`
- API 访问：`http://服务器地址:5001/api/...`
- SQLite 数据库默认保存到 Docker 卷 `/data/records.db`

## 方式一：Docker 部署

在项目根目录执行：

```bash
docker build -t local-line-chart-tool .
docker run -d \
  --name line-chart-tool \
  -p 5001:5001 \
  -v line-chart-data:/data \
  local-line-chart-tool
```

然后浏览器打开：

```text
http://服务器地址:5001
```

如果是在本机测试：

```text
http://127.0.0.1:5001
```

### 查看日志

```bash
docker logs -f line-chart-tool
```

### 停止服务

```bash
docker stop line-chart-tool
```

### 重新部署

```bash
docker stop line-chart-tool
docker rm line-chart-tool
docker build -t local-line-chart-tool .
docker run -d \
  --name line-chart-tool \
  -p 5001:5001 \
  -v line-chart-data:/data \
  local-line-chart-tool
```

`line-chart-data` 这个 Docker 卷会保留 SQLite 数据，不会因为容器重建而丢失。

## 方式二：Render 部署

Render 可以直接从 GitHub 仓库读取这个项目，并使用项目根目录的 `Dockerfile` 构建。

推荐步骤：

1. 把项目推送到 GitHub。
2. 打开 Render，选择 `New` -> `Blueprint`。
3. 连接你的 GitHub 仓库。
4. Render 会读取项目根目录的 `render.yaml`。
5. 确认服务名称、磁盘和环境变量后创建服务。

项目里的 `render.yaml` 已配置：

- Docker 环境
- 自动部署
- `/data` 持久化磁盘
- `DATA_DIR=/data`

部署成功后，Render 会给你一个公开访问地址。

## 方式三：手动部署

### 1. 打包前端

```bash
cd frontend
npm install
npm run build
```

打包结果会生成到：

```text
frontend/dist
```

### 2. 安装后端依赖

```bash
cd ../backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. 启动生产服务

```bash
cd ..
DATA_DIR="$PWD/backend/data" backend/.venv/bin/gunicorn \
  -w 2 \
  -b 0.0.0.0:5001 \
  backend.app:app
```

浏览器打开：

```text
http://服务器地址:5001
```

## Nginx 反向代理示例

如果你有域名，例如 `example.com`，可以用 Nginx 转发到 Gunicorn：

```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

正式公开访问时，建议再配置 HTTPS。

## 数据持久化

SQLite 数据库路径可以用环境变量控制：

```bash
DATA_DIR=/data
```

或直接指定完整数据库文件：

```bash
DB_PATH=/data/records.db
```

部署平台如果会重启或重建容器，一定要挂载持久化磁盘，否则 SQLite 文件可能丢失。
