<?php if(!empty($_GET['redirect'])): ?>
no login!<br/><hr/>
<?php endif ?>
<?php if($user->flashEnabled('authMessage')): ?>
<p class="error auth-message"><?php echo $user->flashMessage('authMessage'); ?></p>
<?php endif; ?>
<div class="metro-pivot">
	<div class="pivot-item" name="login">
		<h3>login</h3>
		<form method="POST">
			<input type="password" name="pass" placeholder="input your password" /> 
			<input type="submit" value="login" />
			<label for="cookie">cookie</label>
			<input type="checkbox" value="true" name="cookie" id="cookie" />
		</form>
	</div>
</div>
