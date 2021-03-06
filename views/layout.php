<!-- -*- mode: HTML; -*- -->
<!DOCTYPE html> 
<html lang="ja">
<head>
<meta charset="UTF-8" /> 
<meta name=" robots" content="noindex,nofollow,nocache,noarchive">
<meta name="format-detection" content="telephone=no" />
<meta name="viewport" content="width=320px,initial-scale=1.0,minimum-scale=1.0,maximum-scale=1.0,user-scalable=no" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black" />
<!-- meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" / -->
<link rel="shortcut icon" href="./images/apple-touch-icon.png" />
<link rel="apple-touch-icon" href="./images/apple-touch-icon.png" />
<!-- link rel="apple-touch-icon" href="apple-touch-icon-precomposed.png" / -->
<base href="<?php print $options->mountPoint; ?>/">
<title><?php echo TiarraWEB::$page_title; ?></title>
<link type="text/css" rel="stylesheet" href="css/jquery.metro.css" />
<link type="text/css" rel="stylesheet" href="css/jquery.jgrowl.css" />
<link type="text/css" rel="stylesheet" href="css/jquery.lightbox-0.5.css" />
<link type="text/css" rel="stylesheet" href="css/metro.notifier.css" />
<link type="text/css" rel="stylesheet" href="<?php print ((strpos( $options->style, 'http' )!==false)?'':'css/').$options->style; ?>" />
<script type="text/javascript" src= "js/jquery.js"></script>
<script type="text/javascript" src= "js/jquery.metro.js"></script>
<script type="text/javascript" src= "js/jquery.touchwipe.min.js"></script>
<script type="text/javascript" src= "js/jquery.jgrowl_minimized.js"></script>
<script type="text/javascript" src= "js/jquery.lightbox-0.5.min.js"></script>
<?php if( !empty( $jsConf['keymapping'] )){ ?>
<script type="text/javascript" src= "js/jquery.hotkeys.js"></script>
<?php } ?>
<script type="text/javascript" src= "js/metroNotifier.js"></script>
<script type="text/javascript" src= "js/tiarraMetro.js"></script>
</head>
<body theme="<?php print $options->theme; ?>" accent="<?php print $options->accent; ?>">
<?php if( !empty( $options->wallparper )){ ?>
  <div id='wallparper' style='background-image: url("../images/<?php print $options->wallparper; ?>");' >
<?php } ?>
	<div id='container' class='theme-bg'>
      <?php echo $content; ?>
	</div>
	<div id='preload'>
		<img src='./images/spinner_b.gif' style='display: none;' />
	</div>
<?php if( !empty( $options->wallparper )){ ?>
  </div>
<?php } ?>
</body>
</html>
