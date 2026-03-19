# Load / Stress тести

## Встановлення k6

```bash
# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# macOS
brew install k6

# Docker
docker run --rm -i grafana/k6 run - <load-tests/smoke.js
```

## Запуск

```bash
# Smoke test (швидка перевірка)
k6 run load-tests/smoke.js

# Load test (нормальне навантаження)
k6 run load-tests/load.js

# Stress test (пікове навантаження)
k6 run load-tests/stress.js

# Spike test (раптовий сплеск)
k6 run load-tests/spike.js

# З кастомним URL
k6 run -e BASE_URL=https://poroshok.com load-tests/load.js
```

## Результати

| Метрика | Добре | Прийнятно | Погано |
|---------|-------|-----------|--------|
| http_req_duration (p95) | < 500ms | < 1500ms | > 1500ms |
| http_req_failed | 0% | < 1% | > 1% |
