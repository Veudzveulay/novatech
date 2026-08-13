module "ecr" {
  source = "../modules/ecr"

  project_name     = var.project_name
  repository_names = var.repository_names
}
