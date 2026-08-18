module "ecr" {
  source = "../modules/ecr"

  project_name     = var.project_name
  repository_names = var.repository_names
}

module "github_oidc" {
  source = "../modules/github-oidc"

  project_name      = var.project_name
  github_repository = var.github_repository
  repository_arns   = values(module.ecr.repository_arns)
  aws_region        = var.aws_region
}
