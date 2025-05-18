
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use std::env::VarError;

use crate::error::EnvVarError;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WireApi {
    #[default]
    Responses,
    Chat,
    Devin,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct ModelProviderInfo {
    pub name: String,
    pub base_url: String,
    pub env_key: Option<String>,

    pub env_key_instructions: Option<String>,

    pub wire_api: WireApi,
}

impl ModelProviderInfo {
    pub fn api_key(&self) -> crate::error::Result<Option<String>> {
        match &self.env_key {
            Some(env_key) => std::env::var(env_key)
                .and_then(|v| {
                    if v.trim().is_empty() {
                        Err(VarError::NotPresent)
                    } else {
                        Ok(Some(v))
                    }
                })
                .map_err(|_| {
                    crate::error::CodexErr::EnvVar(EnvVarError {
                        var: env_key.clone(),
                        instructions: self.env_key_instructions.clone(),
                    })
                }),
            None => Ok(None),
        }
    }
}

pub fn built_in_model_providers() -> HashMap<String, ModelProviderInfo> {
    use ModelProviderInfo as P;

    [
        (
            "openai",
            P {
                name: "OpenAI".into(),
                base_url: "https://api.openai.com/v1".into(),
                env_key: Some("OPENAI_API_KEY".into()),
                env_key_instructions: Some("Create an API key (https://platform.openai.com) and export it as an environment variable.".into()),
                wire_api: WireApi::Responses,
            },
        ),
        (
            "openrouter",
            P {
                name: "OpenRouter".into(),
                base_url: "https://openrouter.ai/api/v1".into(),
                env_key: Some("OPENROUTER_API_KEY".into()),
                env_key_instructions: None,
                wire_api: WireApi::Chat,
            },
        ),
        (
            "gemini",
            P {
                name: "Gemini".into(),
                base_url: "https://generativelanguage.googleapis.com/v1beta/openai".into(),
                env_key: Some("GEMINI_API_KEY".into()),
                env_key_instructions: None,
                wire_api: WireApi::Chat,
            },
        ),
        (
            "ollama",
            P {
                name: "Ollama".into(),
                base_url: "http://localhost:11434/v1".into(),
                env_key: None,
                env_key_instructions: None,
                wire_api: WireApi::Chat,
            },
        ),
        (
            "mistral",
            P {
                name: "Mistral".into(),
                base_url: "https://api.mistral.ai/v1".into(),
                env_key: Some("MISTRAL_API_KEY".into()),
                env_key_instructions: None,
                wire_api: WireApi::Chat,
            },
        ),
        (
            "deepseek",
            P {
                name: "DeepSeek".into(),
                base_url: "https://api.deepseek.com".into(),
                env_key: Some("DEEPSEEK_API_KEY".into()),
                env_key_instructions: None,
                wire_api: WireApi::Chat,
            },
        ),
        (
            "xai",
            P {
                name: "xAI".into(),
                base_url: "https://api.x.ai/v1".into(),
                env_key: Some("XAI_API_KEY".into()),
                env_key_instructions: None,
                wire_api: WireApi::Chat,
            },
        ),
        (
            "groq",
            P {
                name: "Groq".into(),
                base_url: "https://api.groq.com/openai/v1".into(),
                env_key: Some("GROQ_API_KEY".into()),
                env_key_instructions: None,
                wire_api: WireApi::Chat,
            },
        ),
        (
            "devin",
            P {
                name: "Devin".into(),
                base_url: "https://api.devin.ai/v1".into(),
                env_key: Some("DEVIN_API_KEY".into()),
                env_key_instructions: Some("Create a Devin API key (https://docs.devin.ai/api-reference) and export it as an environment variable.".into()),
                wire_api: WireApi::Devin,
            },
        ),
    ]
    .into_iter()
    .map(|(k, v)| (k.to_string(), v))
    .collect()
}
