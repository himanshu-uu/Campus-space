from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    PROJECT_NAME: str = "CampusPulse & SpaceSync"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    DB_PATH: Path = BASE_DIR / "Database" / "campus_sync.db"
    
    # Campus operational hours
    CAMPUS_OPEN_HOUR: int = 8
    CAMPUS_CLOSE_HOUR: int = 22

settings = Settings()
