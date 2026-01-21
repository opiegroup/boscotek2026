import { createClient } from "npm:@supabase/supabase-js";

// Environment variables (set in Supabase Dashboard > Edge Functions > Secrets)
const supabaseUrl = Deno.env.get("PROJECT_URL");
const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
const brevoApiKey = Deno.env.get("BREVO_API_KEY");
const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL") || "timm.mcvaigh@opiegroup.com.au";

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

// Generate a random temporary password
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Send welcome email with temporary password via Brevo
async function sendWelcomeEmail(
  email: string, 
  tempPassword: string, 
  fullName: string | null,
  appUrl: string
): Promise<{ success: boolean; error?: string }> {
  // Try Brevo API if available
  if (brevoApiKey) {
    try {
      console.log("Sending welcome email via Brevo to:", email);
      
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f59e0b;">Welcome to the Product Configurator</h2>
          <p>Hi${fullName ? ` ${fullName}` : ''},</p>
          <p>An account has been created for you. Use the following credentials to sign in:</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 10px 0 0 0;"><strong>Temporary Password:</strong> <code style="background: #e5e5e5; padding: 4px 8px; border-radius: 4px; font-size: 16px;">${tempPassword}</code></p>
          </div>
          <p><a href="${appUrl}" style="display: inline-block; background: #f59e0b; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Sign In Now</a></p>
          <p style="color: #666; font-size: 14px;">You will be required to change your password after signing in.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">Opie Manufacturing Group</p>
        </div>
      `;

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': brevoApiKey,
        },
        body: JSON.stringify({
          sender: {
            name: 'Product Configurator',
            email: senderEmail,
          },
          to: [
            {
              email: email,
              name: fullName || email.split('@')[0],
            }
          ],
          subject: 'Your Product Configurator Account',
          htmlContent: emailHtml,
        }),
      });

      const responseText = await response.text();
      console.log("Brevo response:", response.status, responseText);

      if (!response.ok) {
        console.error('Brevo API error:', response.status, responseText);
        return { success: false, error: 'Failed to send email: ' + responseText };
      }

      console.log("Email sent successfully via Brevo");
      return { success: true };
    } catch (err) {
      console.error('Email send error:', err);
      return { success: false, error: 'Failed to send email' };
    }
  }

  // Fallback: Log the password (for development/testing)
  console.log(`📧 TEMP PASSWORD for ${email}: ${tempPassword}`);
  console.log(`   (Set BREVO_API_KEY to send actual emails)`);
  
  return { success: false }; // Return false so admin sees the password
}

type UserRole = 'super_admin' | 'admin' | 'pricing_manager' | 'sales' | 'distributor' | 'viewer';

interface InvitePayload {
  action?: 'delete'; // Optional action type
  email: string;
  role?: UserRole;
  userId?: string; // For delete action
  fullName?: string;
  brandId?: string;
  brandAccessLevel?: string;
  assignAllBrands?: boolean;
  resendInvite?: boolean; // If true, reset password for existing user
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
    console.log("invite-user: Auth header present:", !!authHeader);
    
    const { isAdmin, userId } = await verifyAdminUser(authHeader);
    console.log("invite-user: isAdmin:", isAdmin, "userId:", userId);

    if (!isAdmin) {
      console.log("invite-user: Unauthorized - user is not admin");
      return new Response(JSON.stringify({ error: "Unauthorized. Only admins can manage users." }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    // Parse request body
    const body: InvitePayload = await req.json();
    console.log("invite-user: Body:", JSON.stringify(body));
    
    // ============================================
    // DELETE USER ACTION
    // ============================================
    if (body.action === 'delete') {
      console.log("invite-user: Deleting user:", body.email);
      
      if (!body.userId) {
        return new Response(JSON.stringify({ error: "userId is required for delete" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      // Delete the user from Supabase Auth
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(body.userId);
      
      if (deleteError) {
        console.error("Delete failed:", deleteError);
        return new Response(JSON.stringify({ error: "Failed to delete user: " + deleteError.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }

      console.log("invite-user: User deleted:", body.email);
      
      return new Response(JSON.stringify({
        success: true,
        message: "User deleted",
        email: body.email,
      }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // ============================================
    // INVITE/CREATE USER ACTION
    // ============================================
    console.log("invite-user: Processing user:", body.email, "with role:", body.role);

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

    // App URL for login
    const appUrl = Deno.env.get("APP_URL") || "https://configurator.boscotek.com.au";

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === body.email.toLowerCase());

    if (existingUser) {
      // RESEND - Generate new temp password for existing user
      if (body.resendInvite) {
        console.log("invite-user: Resending credentials to existing user:", body.email);
        
        // Generate new temporary password
        const tempPassword = generateTempPassword();
        
        // Update user's password
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          password: tempPassword,
          user_metadata: {
            ...existingUser.user_metadata,
            must_change_password: true,
            temp_password_set_at: new Date().toISOString(),
          },
        });

        if (updateError) {
          console.error("Failed to update password:", updateError);
          return new Response(JSON.stringify({ error: "Failed to reset password: " + updateError.message }), {
            status: 500,
            headers: corsHeaders,
          });
        }

        // Send email with new credentials
        const emailResult = await sendWelcomeEmail(
          body.email, 
          tempPassword, 
          existingUser.user_metadata?.full_name || body.fullName || null,
          appUrl
        );

        return new Response(JSON.stringify({
          success: true,
          message: emailResult.success 
            ? "New credentials sent to " + body.email
            : "Password reset - share the temp password manually",
          userId: existingUser.id,
          email: body.email,
          isResend: true,
          emailSent: emailResult.success,
          // Include temp password if email wasn't sent so admin can share manually
          tempPassword: emailResult.success ? undefined : tempPassword,
        }), {
          status: 200,
          headers: corsHeaders,
        });
      }

      // User exists and not resending - check if they have a role
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', existingUser.id)
        .single();

      if (existingRole) {
        return new Response(JSON.stringify({ 
          error: "User already exists with a role assigned. Use 'Resend' to send them new credentials.",
          existingUserId: existingUser.id 
        }), {
          status: 409,
          headers: corsHeaders,
        });
      }

      // Assign role to existing user (they exist but no role yet)
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: existingUser.id, role: body.role });

      if (roleError) {
        console.error("Failed to assign role:", roleError);
        return new Response(JSON.stringify({ error: "Failed to assign role: " + roleError.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }

      // Create user profile if fullName provided
      if (body.fullName) {
        await supabaseAdmin
          .from('user_profiles')
          .upsert({ id: existingUser.id, full_name: body.fullName });
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

    // ============================================
    // CREATE NEW USER WITH TEMPORARY PASSWORD
    // ============================================
    
    const tempPassword = generateTempPassword();
    console.log("invite-user: Creating new user with temp password:", body.email);

    // Create user with temporary password
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: body.fullName || null,
        invited_by: userId,
        must_change_password: true,
        temp_password_set_at: new Date().toISOString(),
      },
    });

    if (createError) {
      console.error("User creation failed:", createError);
      return new Response(JSON.stringify({ error: "Failed to create user: " + createError.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    if (!createData?.user) {
      return new Response(JSON.stringify({ error: "User created but no data returned" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const newUserId = createData.user.id;
    console.log("invite-user: User created with ID:", newUserId);

    // Send welcome email with credentials
    const emailResult = await sendWelcomeEmail(body.email, tempPassword, body.fullName || null, appUrl);

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

    console.log("invite-user: Success - user created:", body.email);

    return new Response(JSON.stringify({
      success: true,
      message: emailResult.success 
        ? "User created and credentials sent to " + body.email
        : "User created - share the temp password manually",
      userId: newUserId,
      email: body.email,
      role: body.role,
      isNewUser: true,
      emailSent: emailResult.success,
      // Include temp password if email wasn't sent so admin can share manually
      tempPassword: emailResult.success ? undefined : tempPassword,
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
