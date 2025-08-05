@echo off
echo Setting up AQI API for Docker...

REM Copy environment file
if not exist .env (
    echo Creating .env file from template...
    copy env.example .env
    echo.
    echo IMPORTANT: Please edit .env file and set your IQAIR_API_KEY
    echo You can get an API key from: https://www.iqair.com/air-pollution-data-api
    echo.
)

REM Create logs directory
if not exist logs (
    echo Creating logs directory...
    mkdir logs
)

echo Setup complete! You can now run:
echo   docker-compose up -d
echo.
echo Optional management tools:
echo   docker-compose --profile tools up -d
echo.
pause
