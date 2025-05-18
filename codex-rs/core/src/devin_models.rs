
pub const DEVIN_MODELS: [&str; 2] = ["devin-standard", "devin-deep"];

pub fn is_devin_model(model: &str) -> bool {
    model.starts_with("devin-")
}

pub fn is_devin_model_supported(model: &str) -> bool {
    DEVIN_MODELS.contains(&model)
}
