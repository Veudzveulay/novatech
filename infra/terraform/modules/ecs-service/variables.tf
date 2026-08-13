variable "project_name" {
  description = "Nom du projet utilise pour le nommage et les tags."
  type        = string
}

variable "environment" {
  description = "Environnement du service ECS."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment doit valoir staging ou production."
  }
}

variable "component_name" {
  description = "Nom normalise du composant."
  type        = string

  validation {
    condition = contains([
      "frontend",
      "api-gateway",
      "auth",
      "paie",
      "conges",
      "recrutement"
    ], var.component_name)
    error_message = "component_name doit etre l'un des six composants NovaTech."
  }
}

variable "image_uri" {
  description = "URI immuable de l'image, taguee par SHA Git ou referencee par digest."
  type        = string

  validation {
    condition     = length(trimspace(var.image_uri)) > 0 && !can(regex(":latest$", var.image_uri))
    error_message = "image_uri ne doit pas etre vide ni utiliser le tag latest."
  }
}

variable "container_port" {
  description = "Port unique expose par le composant."
  type        = number
}

variable "cpu" {
  description = "Unites CPU Fargate de la task definition."
  type        = number
  default     = 256
}

variable "memory" {
  description = "Memoire Fargate en MiB de la task definition."
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Nombre de taches souhaite pour le service."
  type        = number
  default     = 1

  validation {
    condition     = var.desired_count >= 0
    error_message = "desired_count doit etre positif ou nul."
  }
}

variable "aws_region" {
  description = "Region utilisee par le pilote awslogs."
  type        = string
}

variable "cluster_id" {
  description = "Identifiant du cluster ECS partage par l'environnement."
  type        = string
}

variable "execution_role_arn" {
  description = "ARN du role IAM d'execution partage par les task definitions."
  type        = string
}

variable "subnet_ids" {
  description = "Subnets publics utilises par les taches Fargate du workshop."
  type        = list(string)
}

variable "security_group_ids" {
  description = "Security Groups attaches aux interfaces reseau des taches."
  type        = list(string)
}

variable "environment_variables" {
  description = "Variables d'environnement non sensibles du conteneur."
  type        = map(string)
  default     = {}
}

variable "target_group_arn" {
  description = "ARN facultatif du target group ALB blue."
  type        = string
  default     = null
  nullable    = true
}

variable "service_discovery_registry_arn" {
  description = "ARN facultatif du service Cloud Map interne."
  type        = string
  default     = null
  nullable    = true
}

variable "log_retention_days" {
  description = "Retention CloudWatch Logs en jours."
  type        = number
  default     = 7
}
