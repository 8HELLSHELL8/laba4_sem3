# Базовый образ Apache
FROM httpd:2.4

# Копирование конфигурации Apache
COPY ./httpd.conf /usr/local/apache2/conf/httpd.conf

# Копирование собранных файлов React в директорию Apache
COPY ./build/ /usr/local/apache2/htdocs/

# Порт, на котором будет работать Apache
EXPOSE 80

# Запуск Apache
CMD ["httpd-foreground"]