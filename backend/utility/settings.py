#!/usr/bin/env python3

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

load_dotenv()


class Settings(BaseSettings):
    host_ip: str = "0.0.0.0"
    service_port: int = 5200
    api_url: str = "http://localhost:5200"

    openai_api_key: str = ""
    news_fetch_user_agent: str = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
    )

    branch: str | None = None
    commit_id: str | None = None

    news_retention_days: int = 30

    database_url: str = "sqlite+aiosqlite:///./database/mockmate.db"
    database_echo: bool = True

    prefix: str = "/api"
    prefix_no_auth: str = "/api/public"

    cors_origins: list[str] = ["*"]
    cors_methods: list[str] = ["*"]
    cors_headers: list[str] = ["*"]

    class Config:
        env_file = ".env"

    def print(self) -> None:
        print("MockMate Settings:")
        for key, value in self.model_dump().items():
            print(f"  {key}:", value)


settings = Settings()  # type: ignore[call-arg]
