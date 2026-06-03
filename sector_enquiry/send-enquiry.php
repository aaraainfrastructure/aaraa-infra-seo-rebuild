<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $name     = htmlspecialchars(trim($_POST["name"]));
    $mobile   = htmlspecialchars(trim($_POST["mobile"]));
    $email    = htmlspecialchars(trim($_POST["email"]));
    $service  = htmlspecialchars(trim($_POST["service"]));

    $to = "aipromptgowri@gmail.com, nk@aaraaengineering.com, alekhya@aaraaengineering.com";
    $subject = "New Enquiry from Aaraa Infrastructure Website";
    $message = "
        You have received a new enquiry:\n\n
        Name: $name\n
        Mobile: $mobile\n
        Email: $email\n
        Service Interested: $service
    ";
    $headers = "From: noreply@aaraainfrastructure.com\r\n" .
               "Reply-To: $email\r\n" .
               "X-Mailer: PHP/" . phpversion();

    if (mail($to, $subject, $message, $headers)) {
        echo "success";
    } else {
        echo "error";
    }
}
?>
