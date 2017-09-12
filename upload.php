<?php
session_start();
// $conn= mysqli_connect("localhost", "maxparseFFSadmin", "W+.xHael*cBc", "maxparseFFS");
$conn= mysqli_connect("mysql.etrbe.com", "maxparseffsadmin", "W+.xHael*cBc", "maxparseffs");
$ds          = DIRECTORY_SEPARATOR;  //1
$storeFolder = 'uploads';   //2
 
if (!empty($_FILES)) {
    $vendorEmail=(isset($_POST['vendorEmail'])? $_POST['vendorEmail'] : "NULL");
    $campaignCode=(isset($_POST['campaignCode'])? $_POST['campaignCode'] : "NULL");
    $vendorID=(isset($_POST['vendorID'])? $_POST['vendorID'] : "NULL");
    $sequenceCode=(isset($_POST['sequenceCode'])? $_POST['sequenceCode'] : "NULL");

    $_SESSION["campaignCode"]=$campaignCode;
    $_SESSION["vendorEmail"]=$vendorEmail;
    $_SESSION["vendorID"]=$vendorID;
    $_SESSION["sequenceCode"]=$sequenceCode;
    if(($handle= fopen($_FILES['file']['tmp_name'], 'r'))!==FALSE){
        $row=1;
        while (($data= fgetcsv($handle,1000,","))!==FALSE){
            if($row == 1) { }
            else {
                    /*$query="SELECT id FROM `parse` WHERE email='$data[0]' AND campaign_code='$campaignCode'";
                    $result=mysqli_query($conn, $query) or die(mysqli_error($conn));
                    if(mysqli_num_rows($result)>0){
                  

                    } else {
                
                    $qu="INSERT INTO `parse`(`vendor_email`, `campaign_code`, `vendor_id`, `sequence_code`, `lead_date`, `email`, `f_name`, `l_name`, `street_address`, `city`, `state`, `zipcode`, `phone`, `dma`, `fadaf`, `optin`, `intent`)
                         VALUES ('$vendorEmail','$campaignCode','$vendorID','$sequenceCode',NOW(),'$data[0]','$data[1]','$data[2]','$data[8].' '.$data[9]','$data[4]','$data[5]','$data[3]','$data[6]','$data[12]','$data[11]','$data[7]','$data[10]')";


                    $re= mysqli_query($conn, $qu) or die(mysqli_error($conn));
                        //$last_id = mysqli_insert_id($conn);
                        //array_push($inserted_ids,$last_id);
                    }*/
                    
            }
            $row++;
        }
        fclose($handle);
        
    }

    $tempFile = $_FILES['file']['tmp_name'];          //3             
      
    $targetPath = dirname( __FILE__ ) . $ds. $storeFolder . $ds;  //4
     
    $targetFile =  $targetPath. $_FILES['file']['name'];  //5
 
    move_uploaded_file($tempFile,$targetFile); //6
     
}


?>     