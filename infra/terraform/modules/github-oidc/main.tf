data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

locals {
  environments = ["staging", "production"]
  components   = ["frontend", "api-gateway", "auth", "paie", "conges", "recrutement"]

  cluster_arns = [
    for environment in local.environments :
    "arn:${data.aws_partition.current.partition}:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:cluster/${var.project_name}-${environment}-cluster"
  ]

  service_arns = flatten([
    for environment in local.environments : [
      for component in local.components :
      "arn:${data.aws_partition.current.partition}:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:service/${var.project_name}-${environment}-cluster/${var.project_name}-${environment}-${component}-service"
    ]
  ])

  task_execution_role_arns = [
    for environment in local.environments :
    "arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:role/${var.project_name}-${environment}-ecs-task-execution"
  ]

  ecs_infrastructure_role_arns = [
    for environment in local.environments :
    "arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:role/${var.project_name}-${environment}-ecs-infrastructure"
  ]
}

resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = ["sts.amazonaws.com"]
}

resource "aws_iam_role" "github_deploy" {
  name = "${var.project_name}-github-deploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:ref:refs/heads/main"
        }
      }
    }]
  })

  tags = {
    Project   = var.project_name
    ManagedBy = "Terraform"
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name = "${var.project_name}-github-deploy"
  role = aws_iam_role.github_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ECRAuthorization"
        Effect   = "Allow"
        Action   = "ecr:GetAuthorizationToken"
        Resource = "*"
      },
      {
        Sid    = "ECRPushImages"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:CompleteLayerUpload",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:UploadLayerPart"
        ]
        Resource = var.repository_arns
      },
      {
        Sid    = "ECSUpdateServices"
        Effect = "Allow"
        Action = [
          "ecs:DescribeServices",
          "ecs:UpdateService"
        ]
        Resource = local.service_arns
      },
      {
        Sid    = "ECSReadAndRegisterTaskDefinitions"
        Effect = "Allow"
        Action = [
          "ecs:DescribeTaskDefinition",
          "ecs:RegisterTaskDefinition"
        ]
        Resource = "*"
      },
      {
        Sid      = "PassECSTaskExecutionRoles"
        Effect   = "Allow"
        Action   = "iam:PassRole"
        Resource = local.task_execution_role_arns
        Condition = {
          StringEquals = {
            "iam:PassedToService" = "ecs-tasks.amazonaws.com"
          }
        }
      },
      {
        Sid      = "PassECSInfrastructureRoles"
        Effect   = "Allow"
        Action   = "iam:PassRole"
        Resource = local.ecs_infrastructure_role_arns
        Condition = {
          StringEquals = {
            "iam:PassedToService" = "ecs.amazonaws.com"
          }
        }
      }
    ]
  })
}
