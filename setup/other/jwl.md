  Для активації RS256 на production:
  openssl genrsa -out private.pem 2048
  openssl rsa -in private.pem -pubout -out public.pem

  В .env:
  JWT_ALGORITHM=RS256
  JWT_PRIVATE_KEY_PATH=./private.pem
  JWT_PUBLIC_KEY_PATH=./public.pempfdfynf; 