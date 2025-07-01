#!/usr/bin/env python3

from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    host_ip: str = "0.0.0.0"
    service_port: int = 5200
    api_url: str = "http://localhost:5200"

    openai_api_key: str = ""

    branch: str | None = None
    commit_id: str | None = None

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
