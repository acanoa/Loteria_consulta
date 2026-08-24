# Etapa de construcción
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Etapa de producción con servidor Nginx
FROM nginx:alpine

# Copiar la configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copiar los archivos estáticos construidos
COPY --from=build /app/dist /usr/share/nginx/html/apps/loteria-consulta

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
