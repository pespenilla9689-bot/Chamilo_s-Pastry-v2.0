<?php
// ── Gmail SMTP Mailer (no Composer required) ─────────────────
// Setup: enable 2-Step Verification on your Gmail account, then
// generate an App Password at https://myaccount.google.com/apppasswords
// Paste that 16-character password (no spaces) into GMAIL_APP_PASS below.

define('GMAIL_FROM',     'matthewjangayo101@gmail.com');       // ← your Gmail address
define('GMAIL_APP_PASS', 'rdfj njml izri bezi');        // ← your App Password
define('MAIL_FROM_NAME', "Chamilo's Pastry");

function sendMail(string $to, string $subject, string $htmlBody): bool {
    $host = 'ssl://smtp.gmail.com';
    $port = 465;

    $sock = @fsockopen($host, $port, $errno, $errstr, 15);
    if (!$sock) return false;

    $read = function () use ($sock): string {
        $r = '';
        while ($line = fgets($sock, 515)) {
            $r .= $line;
            if ($line[3] === ' ') break;
        }
        return $r;
    };

    $cmd = function (string $c) use ($sock, $read): string {
        fwrite($sock, $c . "\r\n");
        return $read();
    };

    $read(); // server banner
    $cmd('EHLO localhost');
    $cmd('AUTH LOGIN');
    $cmd(base64_encode(GMAIL_FROM));
    $r = $cmd(base64_encode(str_replace(' ', '', GMAIL_APP_PASS)));
    if (strpos($r, '235') === false) { fclose($sock); return false; }

    $cmd('MAIL FROM: <' . GMAIL_FROM . '>');
    $cmd('RCPT TO: <' . $to . '>');
    $cmd('DATA');

    $msg  = "From: " . MAIL_FROM_NAME . " <" . GMAIL_FROM . ">\r\n";
    $msg .= "To: <{$to}>\r\n";
    $msg .= "Subject: {$subject}\r\n";
    $msg .= "MIME-Version: 1.0\r\n";
    $msg .= "Content-Type: text/html; charset=utf-8\r\n\r\n";
    $msg .= $htmlBody . "\r\n.\r\n";

    fwrite($sock, $msg);
    $res = $read();
    $cmd('QUIT');
    fclose($sock);

    return strpos($res, '250') === 0;
}

function otpEmailBody(string $code, string $purpose): string {
    $label = $purpose === 'forgot_password' ? 'Reset Password' : 'Change Password';
    return "
    <div style='font-family:Poppins,sans-serif;max-width:480px;margin:0 auto;padding:32px;
                background:#fff;border-radius:20px;border:1px solid #e8d5ff'>
      <h2 style='color:#4a3668;margin:0 0 8px'>Chamilo's Pastry</h2>
      <p style='color:#7a6675;margin:0 0 24px;font-size:0.9rem'>{$label} Verification</p>
      <p style='color:#3d3047;font-size:0.95rem;margin:0 0 16px'>
        Your verification code is:
      </p>
      <div style='font-size:2.6rem;font-weight:700;letter-spacing:0.6em;color:#7a5fa8;
                  background:#f5f0ff;border-radius:14px;padding:18px;text-align:center;
                  margin-bottom:20px'>{$code}</div>
      <p style='color:#9a849f;font-size:0.82rem;margin:0'>
        This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
      </p>
    </div>";
}
