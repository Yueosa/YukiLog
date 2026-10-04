use crate::repo::error::RepoError;

pub type ServiceResult<T> = Result<T, ServiceError>;

#[derive(Debug, thiserror::Error)]
pub enum ServiceError {
    #[error("repository error: {0}")]
    Repo(#[from] RepoError),

    #[error("invalid input: {0}")]
    InvalidInput(String),

    #[error("not found")]
    NotFound,

    #[error("service unavailable: {0}")]
    Unavailable(String),
}

impl From<sea_orm::DbErr> for ServiceError {
    fn from(e: sea_orm::DbErr) -> Self {
        ServiceError::Repo(RepoError::Db(e))
    }
}
