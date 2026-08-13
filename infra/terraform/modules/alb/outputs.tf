output "alb_arn" {
  description = "ARN de l'Application Load Balancer."
  value       = aws_lb.this.arn
}

output "alb_dns_name" {
  description = "Nom DNS public de l'Application Load Balancer."
  value       = aws_lb.this.dns_name
}

output "alb_zone_id" {
  description = "Zone ID Route 53 de l'Application Load Balancer."
  value       = aws_lb.this.zone_id
}

output "http_listener_arn" {
  description = "ARN du listener HTTP."
  value       = aws_lb_listener.http.arn
}

output "frontend_production_listener_rule_arn" {
  description = "ARN de la regle de production /* du frontend."
  value       = aws_lb_listener_rule.frontend.arn
}

output "api_gateway_production_listener_rule_arn" {
  description = "ARN de la regle de production /api/* de l'API Gateway."
  value       = aws_lb_listener_rule.api_gateway.arn
}

output "frontend_test_listener_rule_arn" {
  description = "ARN de la regle de preview Green du frontend."
  value       = aws_lb_listener_rule.frontend_preview.arn
}

output "api_gateway_test_listener_rule_arn" {
  description = "ARN de la regle de preview Green de l'API Gateway."
  value       = aws_lb_listener_rule.api_gateway_preview.arn
}

output "target_group_health_alarm_names" {
  description = "Noms des alarmes de sante blue et green par composant."
  value = {
    for component in ["frontend", "api-gateway"] : component => [
      aws_cloudwatch_metric_alarm.unhealthy_hosts["${component}-blue"].alarm_name,
      aws_cloudwatch_metric_alarm.unhealthy_hosts["${component}-green"].alarm_name
    ]
  }
}

output "target_group_health_alarm_arns" {
  description = "ARN des alarmes de sante blue et green par composant."
  value = {
    for component in ["frontend", "api-gateway"] : component => [
      aws_cloudwatch_metric_alarm.unhealthy_hosts["${component}-blue"].arn,
      aws_cloudwatch_metric_alarm.unhealthy_hosts["${component}-green"].arn
    ]
  }
}

output "frontend_target_group_arn" {
  description = "ARN du target group frontend blue initialement actif."
  value       = aws_lb_target_group.this["frontend-blue"].arn
}

output "api_gateway_target_group_arn" {
  description = "ARN du target group API Gateway blue initialement actif."
  value       = aws_lb_target_group.this["api-gateway-blue"].arn
}

output "frontend_target_group_arns" {
  description = "ARN blue et green du frontend pour le deploiement Blue/Green ECS."
  value = {
    blue  = aws_lb_target_group.this["frontend-blue"].arn
    green = aws_lb_target_group.this["frontend-green"].arn
  }
}

output "api_gateway_target_group_arns" {
  description = "ARN blue et green de l'API Gateway pour le deploiement Blue/Green ECS."
  value = {
    blue  = aws_lb_target_group.this["api-gateway-blue"].arn
    green = aws_lb_target_group.this["api-gateway-green"].arn
  }
}
