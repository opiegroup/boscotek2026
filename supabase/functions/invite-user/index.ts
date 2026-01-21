import { createClient } from "npm:@supabase/supabase-js";

// Environment variables (set in Supabase Dashboard > Edge Functions > Secrets)
const supabaseUrl = Deno.env.get("PROJECT_URL");
const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("PROJECT_URL or SERVICE_ROLE_KEY is not set for the function environment.");
}

// Service role client - has admin privileges
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json",
};

type UserRole = 'super_admin' | 'admin' | 'pricing_manager' | 'sales' | 'distributor' | 'viewer';

interface InvitePayload {
  email: string;
  role: UserRole;
  fullName?: string;
  brandId?: string;
  brandAccessLevel?: string;
  assignAllBrands?: boolean;
  resendInvite?: boolean; // If true, just resend invite to existing user
}

// Verify the requesting user is an admin
async function verifyAdminUser(authHeader: string | null): Promise<{ isAdmin: boolean; userId: string | null }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { isAdmin: false, userId: null };
  }

  const token = authHeader.replace('Bearer ', '');
  
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  
  if (error || !user) {
    console.error("Auth verification failed:", error);
    return { isAdmin: false, userId: null };
  }

  // Check if user has admin or super_admin role
  const { data: roles, error: rolesError } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'super_admin']);

  if (rolesError || !roles || roles.length === 0) {
    return { isAdmin: false, userId: user.id };
  }

  return { isAdmin: true, userId: user.id };
}

export const handler = async (req: Request): Promise<Response> => {
  console.log("invite-user: Request received");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    const { isAdmin, userId } = await verifyAdminUser(authHeader);

    if (!isAdmin) {
      console.log("invite-user: Unauthorized - user is not admin");
      return new Response(JSON.stringify({ error: "Unauthorized. Only admins can invite users." }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    // Parse request body
    const body: InvitePayload = await req.json();
    console.log("invite-user: Inviting user:", body.email, "with role:", body.role);

    if (!body.email || !body.role) {
      return new Response(JSON.stringify({ error: "Email and role are required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Validate role
    const validRoles: UserRole[] = ['super_admin', 'admin', 'pricing_manager', 'sales', 'distributor', 'viewer'];
    if (!validRoles.includes(body.role)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // App URL for redirect
    const appUrl = Deno.env.get("APP_URL") || "https://configurator.boscotek.com.au";

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === body.email.toLowerCase());

    if (existingUser) {
      // RESEND INVITE - Send login email to existing user
      if (body.resendInvite) {
        console.log("invite-user: Resending invite to existing user:", body.email);
        console.log("  - User confirmed:", existingUser.email_confirmed_at ? 'Yes' : 'No');
        
        let emailSent = false;
        let errorMessage = '';

        // For unconfirmed users, re-invite them
        if (!existingUser.email_confirmed_at) {
          console.log("  - User not confirmed, sending invite...");
          const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(body.email, {
            data: {
              full_name: existingUser.user_metadata?.full_name || null,
              reinvited_by: userId,
            },
            redirectTo: `${appUrl}/auth/callback`,
          });

          if (inviteError) {
            console.error("Invite failed:", inviteError);
            errorMessage = inviteError.message;
          } else {
            emailSent = true;
          }
        } else {
          // For confirmed users, send a password reset email
          console.log("  - User confirmed, sending password reset...");
          
          // Create a regular Supabase client to call resetPasswordForEmail
          // (This method sends the actual email)
          const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(body.email, {
            redirectTo: `${appUrl}/auth/callback`,
          });

          if (resetError) {
            console.error("Password reset failed:", resetError);
            errorMessage = resetError.message;
          } else {
            emailSent = true;
          }
        }

        if (!emailSent) {
          return new Response(JSON.stringify({ 
            error: "Failed to send email: " + errorMessage 
          }), {
            status: 500,
            headers: corsHeaders,
          });
        }

        return new Response(JSON.stringify({
          success: true,
          message: existingUser.email_confirmed_at 
            ? "Password reset email sent" 
            : "Invite email resent",
          userId: existingUser.id,
          email: body.email,
          isResend: true,
        }), {
          status: 200,
          headers: corsHeaders,
        });
      }

      // User exists and not resending - just assign role if they don't have one
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', existingUser.id)
        .single();

      if (existingRole && !body.resendInvite) {
        return new Response(JSON.stringify({ 
          error: "User already exists with a role assigned. Use 'Resend Invite' to send them a new login link.",
          existingUserId: existingUser.id 
        }), {
          status: 409,
          headers: corsHeaders,
        });
      }

      // Assign role to existing user
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: existingUser.id, role: body.role });

      if (roleError) {
        console.error("Failed to assign role to existing user:", roleError);
        return new Response(JSON.stringify({ error: "Failed to assign role: " + roleError.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }

      // Create user profile if fullName provided
      if (body.fullName) {
        await supabaseAdmin
          .from('user_profiles')
          .upsert({ 
            id: existingUser.id, 
            full_name: body.fullName 
          });
      }

      return new Response(JSON.stringify({
        success: true,
        message: "Role assigned to existing user",
        userId: existingUser.id,
        email: body.email,
        role: body.role,
        isNewUser: false,
      }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Invite new user via Supabase Admin API
    // This sends them an email with a magic link to set their password
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(body.email, {
      data: {
        full_name: body.fullName || null,
        invited_by: userId,
        initial_role: body.role,
      },
      redirectTo: `${appUrl}/auth/callback`,
    });

    if (inviteError) {
      console.error("Invite failed:", inviteError);
      return new Response(JSON.stringify({ error: "Failed to send invite: " + inviteError.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    if (!inviteData?.user) {
      return new Response(JSON.stringify({ error: "Invite sent but no user data returned" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const newUserId = inviteData.user.id;
    console.log("invite-user: User created with ID:", newUserId);

    // Assign role to the new user
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: newUserId, role: body.role });

    if (roleError) {
      console.error("Failed to assign role:", roleError);
      // Don't fail the whole request - user was created, just log the issue
    }

    // Create user profile if fullName provided
    if (body.fullName) {
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .insert({ 
          id: newUserId, 
          full_name: body.fullName 
        });

      if (profileError) {
        console.error("Failed to create profile:", profileError);
        // Non-critical, continue
      }
    }

    // Assign to brands
    if (body.assignAllBrands) {
      // Assign to ALL brands
      const { data: allBrands, error: brandsError } = await supabaseAdmin
        .from('brands')
        .select('id')
        .eq('status', 'active');

      if (brandsError) {
        console.error("Failed to fetch brands:", brandsError);
      } else if (allBrands && allBrands.length > 0) {
        const brandAccessRecords = allBrands.map(b => ({
          user_id: newUserId,
          brand_id: b.id,
          access_level: body.brandAccessLevel || 'viewer',
          granted_by: userId,
          is_active: true,
        }));

        const { error: brandError } = await supabaseAdmin
          .from('user_brand_access')
          .upsert(brandAccessRecords, { onConflict: 'user_id,brand_id' });

        if (brandError) {
          console.error("Failed to assign all brands:", brandError);
        } else {
          console.log(`Assigned user to ${allBrands.length} brands`);
        }
      }
    } else if (body.brandId && body.brandAccessLevel) {
      // Assign to specific brand - direct insert instead of RPC (avoids auth.uid() issue)
      const { error: brandError } = await supabaseAdmin
        .from('user_brand_access')
        .upsert({
          user_id: newUserId,
          brand_id: body.brandId,
          access_level: body.brandAccessLevel,
          granted_by: userId,
          is_active: true,
        }, { onConflict: 'user_id,brand_id' });

      if (brandError) {
        console.error("Failed to assign brand:", brandError);
        // Non-critical, continue
      }
    }

    console.log("invite-user: Success - invite sent to", body.email);

    return new Response(JSON.stringify({
      success: true,
      message: "Invite sent successfully",
      userId: newUserId,
      email: body.email,
      role: body.role,
      isNewUser: true,
    }), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (err: any) {
    console.error("invite-user: Unhandled error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};

if (import.meta.main) {
  Deno.serve(handler);
}
