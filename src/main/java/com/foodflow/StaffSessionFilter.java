package com.foodflow;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

public class StaffSessionFilter extends OncePerRequestFilter {
    private final JdbcTemplate db;
    public StaffSessionFilter(JdbcTemplate db){this.db=db;}
    @Override protected boolean shouldNotFilter(HttpServletRequest request){String uri=request.getRequestURI();return !uri.startsWith("/admin")&&!uri.startsWith("/api/admin");}
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws IOException,ServletException{
        var auth=SecurityContextHolder.getContext().getAuthentication();
        if(auth!=null&&auth.getPrincipal() instanceof StaffPrincipal user){
            var rows=db.queryForList("SELECT active,auth_version FROM staff_users WHERE id=?",user.staffId());
            if(rows.isEmpty()||!Boolean.TRUE.equals(rows.getFirst().get("active"))||((Number)rows.getFirst().get("auth_version")).longValue()!=user.authVersion()){
                SecurityContextHolder.clearContext();var session=request.getSession(false);if(session!=null)session.invalidate();
            }
        }
        chain.doFilter(request,response);
    }
}
