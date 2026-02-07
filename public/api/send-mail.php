<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\SMTP;

require 'PHPMailer/Exception.php';
require 'PHPMailer/PHPMailer.php';
require 'PHPMailer/SMTP.php';

header("Access-Control-Allow-Origin: https://www.sposlearning.cz");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    $mail = new PHPMailer(true);

    try {
        // --- SMTP CONFIGURATION ---
        // $mail->SMTPDebug = SMTP::DEBUG_SERVER; // Uncomment this to see errors in the console
        $mail->isSMTP();
        $mail->Host       = 'smtp.forpsi.com'; // Or your hosting SMTP host
        $mail->SMTPAuth   = true;
        $mail->Username   = 'no-reply@sposlearning.cz';
        $mail->Password   = 'kmzdzQRFw8bga6R#'; // Use an App Password if using Zoho
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;
        $mail->CharSet    = 'UTF-8';

        // --- EMAIL CONTENT ---
        $mail->setFrom('no-reply@sposlearning.cz', 'SPOŠLearning');
        $mail->addAddress('itsteddy@zohomail.eu');
        $mail->addReplyTo($data['contact'], $data['name']);

        $mail->isHTML(true);
        $mail->Subject = 'Nová zpětná vazba: ' . $data['title'];
        $mail->Body    = "
            <h3>Nová zpráva ze SPOŠLearningu</h3>
            <p><b>Od:</b> {$data['name']} ({$data['contact']})</p>
            <p><b>Stránka:</b> {$data['page']}</p>
            <hr>
            <p><b>Zpráva:</b><br>" . nl2br($data['message']) . "</p>
        ";

        $mail->send();
        echo json_encode(["status" => "success"]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $mail->ErrorInfo]);
    }
}