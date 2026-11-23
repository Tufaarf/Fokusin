<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pengingat Deadline Tugas Fokusin</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f7; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e5e7eb; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); overflow: hidden; text-align: left;">
          
          <!-- Header Bar -->
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 24px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">⚡ Fokusin</span>
                    <span style="color: #c7d2fe; font-size: 13px; margin-left: 8px;">Project & Task Management</span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); color: #ffffff; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                      {{ $hTag }} DEADLINE
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #111827; line-height: 1.3;">
                Pengingat Batas Waktu Tugas
              </h1>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #4b5563;">
                Halo <strong>{{ $recipient->name }}</strong>, tugas Anda di project 
                <strong>{{ $task->project ? $task->project->name : 'Project' }}</strong> akan segera jatuh tempo dalam 
                <span style="color: #dc2626; font-weight: 700;">{{ $daysRemaining }} hari lagi</span> (<strong>{{ $hTag }}</strong>). Mohon segera tinjau dan selesaikan tugas tersebut.
              </p>

              <!-- Task Details Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <tr>
                  <td style="padding-bottom: 12px; border-bottom: 1px solid #edf2f7;">
                    <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px;">Judul Tugas</div>
                    <div style="font-size: 16px; font-weight: 700; color: #0f172a;">{{ $task->title }}</div>
                    @if($task->description)
                      <div style="margin-top: 6px; font-size: 13px; color: #475569; line-height: 1.4;">
                        {{ \Illuminate\Support\Str::limit($task->description, 160) }}
                      </div>
                    @endif
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 12px; padding-bottom: 12px; border-bottom: 1px solid #edf2f7;">
                    <table role="presentation" width="100%">
                      <tr>
                        <td width="50%">
                          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px;">Batas Waktu (Due Date)</div>
                          <div style="font-size: 14px; font-weight: 600; color: #dc2626;">
                            {{ $task->due_date ? \Carbon\Carbon::parse($task->due_date)->format('d M Y - H:i') : '-' }} WIB
                          </div>
                        </td>
                        <td width="50%">
                          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px;">Project</div>
                          <div style="font-size: 14px; font-weight: 600; color: #1e293b;">
                            {{ $task->project ? $task->project->name : 'Project' }}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 12px;">
                    <table role="presentation" width="100%">
                      <tr>
                        <td width="50%">
                          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px;">Prioritas</div>
                          @php
                            $priority = strtolower($task->priority ?? 'medium');
                            $bg = match($priority) {
                              'high' => '#fee2e2',
                              'low' => '#dcfce7',
                              default => '#fef3c7',
                            };
                            $color = match($priority) {
                              'high' => '#991b1b',
                              'low' => '#166534',
                              default => '#92400e',
                            };
                          @endphp
                          <span style="display: inline-block; background-color: {{ $bg }}; color: {{ $color }}; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; text-transform: capitalize;">
                            {{ $task->priority ?? 'Medium' }}
                          </span>
                        </td>
                        <td width="50%">
                          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px;">Status Saat Ini</div>
                          <span style="display: inline-block; background-color: #e0f2fe; color: #0369a1; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                            {{ $task->status ?? 'TODO' }}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="{{ $appUrl }}/projects" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.3);">
                      Buka & Kerjakan Tugas di Fokusin &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.5; text-align: center;">
                Anda menerima email ini sebagai penanggung jawab / pemilik tugas di platform Fokusin.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 32px; border-top: 1px solid #f3f4f6; text-align: center;">
              <p style="margin: 0 0 6px; font-size: 12px; color: #9ca3af;">
                Email pengingat dikirim otomatis dari: <strong style="color: #6b7280;">officialfokusin@gmail.com</strong>
              </p>
              <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                &copy; {{ date('Y') }} Fokusin Workspace. Seluruh hak cipta dilindungi.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
