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

output "frontend_target_group_arn" {
  description = "ARN du target group frontend blue initialement actif."
  value       = aws_lb_target_group.this["frontend-blue"].arn
}

output "api_gateway_target_group_arn" {
  description = "ARN du target group API Gateway blue initialement actif."
  value       = aws_lb_target_group.this["api-gateway-blue"].arn
}

output "frontend_target_group_arns" {
  description = "ARN blue et green du frontend pour le futur deploiement CodeDeploy."
  value = {
    blue  = aws_lb_target_group.this["frontend-blue"].arn
    green = aws_lb_target_group.this["frontend-green"].arn
  }
}

output "api_gateway_target_group_arns" {
  description = "ARN blue et green de l'API Gateway pour le futur deploiement CodeDeploy."
  value = {
    blue  = aws_lb_target_group.this["api-gateway-blue"].arn
    green = aws_lb_target_group.this["api-gateway-green"].arn
  }
}
