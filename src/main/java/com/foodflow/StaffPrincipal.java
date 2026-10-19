package com.foodflow;

import java.util.List;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;

public class StaffPrincipal extends User {
    private final long staffId,authVersion;
    public StaffPrincipal(long id,String username,String password,String role,boolean active,long authVersion){
        super(username,password,active,true,true,true,List.of(new SimpleGrantedAuthority("ROLE_"+role)));
        this.staffId=id;this.authVersion=authVersion;
    }
    public long staffId(){return staffId;}
    public long authVersion(){return authVersion;}
}
