<?php

declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');

function sendJson(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(
        $payload,
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE,
    );
    exit;
}

function fail(int $status, string $message): void
{
    sendJson(['erro' => $message], $status);
}

function readConfig(): array
{
    $path = dirname(__DIR__, 2) . '/calendar-config.php';
    if (!is_file($path)) {
        throw new RuntimeException('O arquivo calendar-config.php não foi encontrado fora de public_html.');
    }

    $config = require $path;
    if (!is_array($config)) {
        throw new RuntimeException('A configuração do calendário está inválida.');
    }

    return $config;
}

function configureCors(array $config): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowedOrigins = $config['allowed_origins'] ?? [];

    if ($origin !== '' && !in_array($origin, $allowedOrigins, true)) {
        fail(403, 'Origem não autorizada.');
    }

    if ($origin !== '') {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }

    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    header('Cache-Control: no-store');

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function database(array $config): PDO
{
    $settings = $config['database'] ?? [];
    foreach (['host', 'name', 'user', 'password'] as $key) {
        if (!isset($settings[$key]) || !is_string($settings[$key]) || $settings[$key] === '') {
            throw new RuntimeException('A configuração de conexão com o MySQL está incompleta.');
        }
    }

    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=utf8mb4',
        $settings['host'],
        $settings['name'],
    );

    return new PDO($dsn, $settings['user'], $settings['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}

function base64UrlDecode(string $value): string|false
{
    $padded = strtr($value, '-_', '+/');
    $padded .= str_repeat('=', (4 - strlen($padded) % 4) % 4);
    return base64_decode($padded, true);
}

function firebaseSigningKeys(string $projectId, bool $refresh = false): array
{
    $cachePath = sys_get_temp_dir() . '/firebase-signing-keys-' . hash('sha256', $projectId) . '.json';
    if (!$refresh && is_file($cachePath)) {
        $cached = json_decode((string) file_get_contents($cachePath), true);
        if (
            is_array($cached)
            && isset($cached['expires_at'], $cached['keys'])
            && $cached['expires_at'] > time()
            && is_array($cached['keys'])
        ) {
            return $cached['keys'];
        }
    }

    if (!function_exists('curl_init')) {
        throw new RuntimeException('A extensão cURL do PHP precisa estar habilitada.');
    }

    $curl = curl_init('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_FOLLOWLOCATION => false,
    ]);
    $response = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $headerSize = (int) curl_getinfo($curl, CURLINFO_HEADER_SIZE);
    $curlError = curl_error($curl);
    curl_close($curl);

    if (!is_string($response) || $status !== 200) {
        throw new RuntimeException('Não foi possível validar a sessão Firebase: ' . $curlError);
    }

    $headers = substr($response, 0, $headerSize);
    $body = substr($response, $headerSize);
    $keys = json_decode($body, true);
    if (!is_array($keys) || $keys === []) {
        throw new RuntimeException('O Firebase retornou certificados inválidos.');
    }

    $maxAge = 3600;
    if (preg_match('/cache-control:.*max-age=(\d+)/i', $headers, $matches)) {
        $maxAge = max(60, (int) $matches[1]);
    }
    $cache = json_encode([
        'expires_at' => time() + $maxAge,
        'keys' => $keys,
    ]);
    if (is_string($cache)) {
        if (file_put_contents($cachePath, $cache, LOCK_EX) === false) {
            error_log('[calendar-api] Não foi possível salvar o cache dos certificados Firebase.');
        } elseif (!chmod($cachePath, 0600)) {
            error_log('[calendar-api] Não foi possível restringir as permissões do cache Firebase.');
        }
    }

    return $keys;
}

function authenticatedUserId(array $config): string
{
    $authorization = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($authorization === '' && function_exists('getallheaders')) {
        $headers = getallheaders();
        $authorization = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }

    if (!preg_match('/^Bearer\s+(\S+)$/i', $authorization, $matches)) {
        fail(401, 'Faça login para continuar.');
    }

    $parts = explode('.', $matches[1]);
    if (count($parts) !== 3) {
        fail(401, 'Sessão inválida.');
    }

    $headerJson = base64UrlDecode($parts[0]);
    $claimsJson = base64UrlDecode($parts[1]);
    $signature = base64UrlDecode($parts[2]);
    if (!is_string($headerJson) || !is_string($claimsJson) || !is_string($signature)) {
        fail(401, 'Sessão inválida.');
    }

    $header = json_decode($headerJson, true);
    $claims = json_decode($claimsJson, true);
    $projectId = $config['firebase_project_id'] ?? '';
    if (
        !is_array($header)
        || ($header['alg'] ?? '') !== 'RS256'
        || !isset($header['kid'])
        || !is_string($header['kid'])
        || !is_array($claims)
        || !is_string($projectId)
        || $projectId === ''
    ) {
        fail(401, 'Sessão inválida.');
    }

    $keys = firebaseSigningKeys($projectId);
    if (!isset($keys[$header['kid']])) {
        $keys = firebaseSigningKeys($projectId, true);
    }
    if (!isset($keys[$header['kid']])) {
        fail(401, 'Sessão inválida.');
    }

    $verified = openssl_verify(
        $parts[0] . '.' . $parts[1],
        $signature,
        $keys[$header['kid']],
        OPENSSL_ALGO_SHA256,
    );
    if ($verified !== 1) {
        fail(401, 'Sessão inválida.');
    }

    $now = time();
    if (
        ($claims['aud'] ?? null) !== $projectId
        || ($claims['iss'] ?? null) !== 'https://securetoken.google.com/' . $projectId
        || !isset($claims['sub'], $claims['exp'], $claims['iat'])
        || !is_string($claims['sub'])
        || $claims['sub'] === ''
        || !is_numeric($claims['exp'])
        || (int) $claims['exp'] <= $now
        || !is_numeric($claims['iat'])
        || (int) $claims['iat'] > $now + 60
    ) {
        fail(401, 'Sessão expirada ou inválida.');
    }

    return $claims['sub'];
}

function validatedDate(mixed $value): string
{
    if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
        fail(400, 'Data inválida.');
    }

    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    $errors = DateTimeImmutable::getLastErrors();
    if (
        $date === false
        || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))
        || $date->format('Y-m-d') !== $value
    ) {
        fail(400, 'Data inválida.');
    }

    return $value;
}

function attachmentMetadata(array $row): array
{
    return [
        'id' => $row['id'],
        'name' => $row['original_name'],
        'contentType' => $row['content_type'],
        'size' => (int) $row['file_size'],
        'caption' => $row['caption'],
    ];
}

function isList(array $value): bool
{
    $index = 0;
    foreach (array_keys($value) as $key) {
        if ($key !== $index) {
            return false;
        }
        $index++;
    }

    return true;
}

function handleSummary(PDO $db, string $userId): void
{
    $month = $_GET['month'] ?? null;
    if (!is_string($month) || !preg_match('/^\d{4}-\d{2}$/', $month)) {
        fail(400, 'Mês inválido.');
    }

    $firstDay = DateTimeImmutable::createFromFormat('!Y-m', $month);
    $errors = DateTimeImmutable::getLastErrors();
    if (
        $firstDay === false
        || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))
        || $firstDay->format('Y-m') !== $month
    ) {
        fail(400, 'Mês inválido.');
    }

    $statement = $db->prepare(
        'SELECT entry_date, notes,
                (SELECT COUNT(*) FROM calendar_attachments
                 WHERE user_id = :attachment_user_id
                   AND entry_date = calendar_entries.entry_date) AS attachment_count
         FROM calendar_entries
         WHERE user_id = :user_id
           AND entry_date >= :first_day
           AND entry_date < :next_month',
    );
    $statement->execute([
        'attachment_user_id' => $userId,
        'user_id' => $userId,
        'first_day' => $firstDay->format('Y-m-d'),
        'next_month' => $firstDay->modify('first day of next month')->format('Y-m-d'),
    ]);

    $days = [];
    foreach ($statement->fetchAll() as $row) {
        $decodedNotes = json_decode((string) $row['notes'], true);
        $hasNotes = is_array($decodedNotes) && isList($decodedNotes) && $decodedNotes !== [];
        $hasFiles = (int) $row['attachment_count'] > 0;
        if ($hasNotes || $hasFiles) {
            $days[$row['entry_date']] = ['notes' => $hasNotes, 'files' => $hasFiles];
        }
    }

    sendJson(['days' => $days]);
}

function handleGet(PDO $db, string $userId): void
{
    $action = $_GET['action'] ?? 'entry';
    if ($action === 'summary') {
        handleSummary($db, $userId);
    }

    if ($action === 'download') {
        $id = $_GET['id'] ?? '';
        if (!is_string($id) || !preg_match('/^[a-f0-9]{32}$/', $id)) {
            fail(400, 'Arquivo inválido.');
        }

        $statement = $db->prepare(
            'SELECT original_name, content_type, file_data
             FROM calendar_attachments
             WHERE id = :id AND user_id = :user_id',
        );
        $statement->execute(['id' => $id, 'user_id' => $userId]);
        $file = $statement->fetch();
        if ($file === false) {
            fail(404, 'Arquivo não encontrado.');
        }

        $contents = is_resource($file['file_data'])
            ? stream_get_contents($file['file_data'])
            : $file['file_data'];
        if (!is_string($contents)) {
            throw new RuntimeException('Não foi possível ler o arquivo armazenado.');
        }

        $filename = rawurlencode($file['original_name']);
        header('Content-Type: ' . $file['content_type']);
        header('Content-Length: ' . strlen($contents));
        header('Content-Disposition: attachment; filename="download"; filename*=UTF-8\'\'' . $filename);
        header('X-Content-Type-Options: nosniff');
        echo $contents;
        exit;
    }

    if ($action !== 'entry') {
        fail(400, 'Ação inválida.');
    }

    $date = validatedDate($_GET['date'] ?? null);
    $entryStatement = $db->prepare(
        'SELECT notes FROM calendar_entries WHERE user_id = :user_id AND entry_date = :entry_date',
    );
    $entryStatement->execute(['user_id' => $userId, 'entry_date' => $date]);
    $entry = $entryStatement->fetch();

    $attachmentStatement = $db->prepare(
        'SELECT attachments.id, attachments.original_name, attachments.content_type,
                attachments.file_size, COALESCE(captions.caption, \'\') AS caption
         FROM calendar_attachments AS attachments
         LEFT JOIN calendar_attachment_captions AS captions
           ON captions.attachment_id = attachments.id
         WHERE attachments.user_id = :user_id AND attachments.entry_date = :entry_date
         ORDER BY attachments.created_at, attachments.id',
    );
    $attachmentStatement->execute(['user_id' => $userId, 'entry_date' => $date]);
    $attachments = array_map('attachmentMetadata', $attachmentStatement->fetchAll());

    $decodedNotes = $entry === false ? [] : json_decode((string) $entry['notes'], true);
    $notes = is_array($decodedNotes) && isList($decodedNotes) ? $decodedNotes : [];

    sendJson([
        'notes' => $notes,
        'attachments' => $attachments,
    ]);
}

function handleSave(PDO $db, string $userId, array $payload): void
{
    $date = validatedDate($payload['date'] ?? null);
    $notes = $payload['notes'] ?? null;
    if (!is_array($notes) || !isList($notes) || count($notes) > 100) {
        fail(400, 'A lista de anotações é inválida.');
    }
    foreach ($notes as $note) {
        if (!is_string($note) || trim($note) === '' || strlen($note) > 4000) {
            fail(400, 'Cada anotação deve ter até 1.000 caracteres e não pode ficar vazia.');
        }
    }
    $encodedNotes = json_encode($notes, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (!is_string($encodedNotes) || strlen($encodedNotes) > 40000) {
        fail(400, 'A lista de anotações excede o limite permitido.');
    }

    $statement = $db->prepare(
        'INSERT INTO calendar_entries (user_id, entry_date, notes)
         VALUES (:user_id, :entry_date, :notes)
         ON DUPLICATE KEY UPDATE notes = VALUES(notes)',
    );
    $statement->execute([
        'user_id' => $userId,
        'entry_date' => $date,
        'notes' => $encodedNotes,
    ]);

    sendJson(['sucesso' => true]);
}

function handleSaveCaption(PDO $db, string $userId, array $payload): void
{
    $id = $payload['id'] ?? '';
    $caption = $payload['caption'] ?? null;
    if (!is_string($id) || !preg_match('/^[a-f0-9]{32}$/', $id)) {
        fail(400, 'Arquivo inválido.');
    }
    if (!is_string($caption) || strlen($caption) > 2000) {
        fail(400, 'A legenda deve ter até 500 caracteres.');
    }

    $attachment = $db->prepare(
        'SELECT id, content_type
         FROM calendar_attachments
         WHERE id = :id AND user_id = :user_id',
    );
    $attachment->execute(['id' => $id, 'user_id' => $userId]);
    $attachmentRow = $attachment->fetch();
    if ($attachmentRow === false) {
        fail(404, 'Arquivo não encontrado.');
    }
    if (!str_starts_with($attachmentRow['content_type'], 'image/')) {
        fail(400, 'Legendas só podem ser salvas em fotos.');
    }

    $statement = $db->prepare(
        'INSERT INTO calendar_attachment_captions (attachment_id, caption)
         VALUES (:attachment_id, :caption)
         ON DUPLICATE KEY UPDATE caption = VALUES(caption)',
    );
    $statement->execute(['attachment_id' => $id, 'caption' => trim($caption)]);

    sendJson(['sucesso' => true]);
}

function handleUpload(PDO $db, string $userId): void
{
    $date = validatedDate($_POST['date'] ?? null);
    $file = $_FILES['file'] ?? null;
    if (!is_array($file)) {
        fail(400, 'Nenhum arquivo foi enviado.');
    }
    $uploadError = $file['error'] ?? UPLOAD_ERR_NO_FILE;
    if ($uploadError !== UPLOAD_ERR_OK) {
        if (in_array($uploadError, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            fail(413, 'O arquivo excede o limite de upload configurado no PHP. Configure upload_max_filesize para 16M e post_max_size para 18M.');
        }
        if ($uploadError === UPLOAD_ERR_PARTIAL) {
            fail(400, 'O arquivo chegou incompleto. Tente enviá-lo novamente.');
        }
        if (in_array($uploadError, [UPLOAD_ERR_NO_TMP_DIR, UPLOAD_ERR_CANT_WRITE, UPLOAD_ERR_EXTENSION], true)) {
            fail(500, 'O servidor não conseguiu processar o arquivo. Verifique a configuração de uploads do PHP.');
        }
        fail(400, 'Nenhum arquivo válido foi recebido.');
    }
    if (
        !isset($file['tmp_name'], $file['name'], $file['size'])
        || !is_string($file['tmp_name'])
        || !is_string($file['name'])
        || !is_numeric($file['size'])
        || !is_uploaded_file($file['tmp_name'])
    ) {
        fail(400, 'Arquivo enviado inválido.');
    }

    $size = (int) $file['size'];
    if ($size <= 0 || $size >= 15 * 1024 * 1024) {
        fail(413, 'O arquivo deve ter menos de 15 MB.');
    }

    $originalName = basename(str_replace('\\', '/', (string) $file['name']));
    $originalName = preg_replace('/[\x00-\x1F\x7F]/u', '', $originalName) ?? '';
    if ($originalName === '') {
        fail(400, 'Nome de arquivo inválido.');
    }
    $originalName = preg_replace('/^(.{0,255}).*$/us', '$1', $originalName) ?? '';
    if ($originalName === '') {
        fail(400, 'Nome de arquivo inválido.');
    }

    if (!class_exists('finfo')) {
        throw new RuntimeException('A extensão fileinfo do PHP precisa estar habilitada.');
    }
    $fileInfo = new finfo(FILEINFO_MIME_TYPE);
    $contentType = $fileInfo->file($file['tmp_name']);
    if (!is_string($contentType) || !preg_match('/^[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+$/', $contentType)) {
        $contentType = 'application/octet-stream';
    }

    $id = bin2hex(random_bytes(16));
    $db->beginTransaction();
    try {
        $entryStatement = $db->prepare(
            "INSERT INTO calendar_entries (user_id, entry_date, notes)
             VALUES (:user_id, :entry_date, '')
             ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP",
        );
        $entryStatement->execute(['user_id' => $userId, 'entry_date' => $date]);

        $insert = $db->prepare(
            'INSERT INTO calendar_attachments
                (id, user_id, entry_date, original_name, content_type, file_size, file_data)
             VALUES
                (:id, :user_id, :entry_date, :original_name, :content_type, :file_size, :file_data)',
        );
        $stream = fopen($file['tmp_name'], 'rb');
        if ($stream === false) {
            throw new RuntimeException('Não foi possível abrir o arquivo enviado.');
        }
        $lob = $stream;

        try {
            $insert->bindValue(':id', $id);
            $insert->bindValue(':user_id', $userId);
            $insert->bindValue(':entry_date', $date);
            $insert->bindValue(':original_name', $originalName);
            $insert->bindValue(':content_type', $contentType);
            $insert->bindValue(':file_size', $size, PDO::PARAM_INT);
            $insert->bindParam(':file_data', $lob, PDO::PARAM_LOB);
            $insert->execute();
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }

        $db->commit();
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }

    sendJson([
        'sucesso' => true,
        'arquivo' => [
            'id' => $id,
            'name' => $originalName,
            'contentType' => $contentType,
            'size' => $size,
            'caption' => '',
        ],
    ], 201);
}

function handleDelete(PDO $db, string $userId, array $payload): void
{
    $id = $payload['id'] ?? '';
    if (!is_string($id) || !preg_match('/^[a-f0-9]{32}$/', $id)) {
        fail(400, 'Arquivo inválido.');
    }

    $statement = $db->prepare('DELETE FROM calendar_attachments WHERE id = :id AND user_id = :user_id');
    $statement->execute(['id' => $id, 'user_id' => $userId]);
    if ($statement->rowCount() === 0) {
        fail(404, 'Arquivo não encontrado.');
    }

    sendJson(['sucesso' => true]);
}

try {
    $config = readConfig();
    configureCors($config);

    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    if (!in_array($method, ['GET', 'POST'], true)) {
        header('Allow: GET, POST, OPTIONS');
        fail(405, 'Método não permitido.');
    }

    $userId = authenticatedUserId($config);
    $db = database($config);

    if ($method === 'GET') {
        handleGet($db, $userId);
    }

    $action = $_POST['action'] ?? null;
    if ($action === 'upload') {
        handleUpload($db, $userId);
    }

    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    $contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if (str_starts_with(strtolower($contentType), 'multipart/form-data') && $contentLength > 0) {
        fail(413, 'O envio excedeu o limite de tamanho configurado no PHP.');
    }

    $payload = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        fail(400, 'Corpo da solicitação inválido.');
    }

    if (($payload['action'] ?? '') === 'save') {
        handleSave($db, $userId, $payload);
    }
    if (($payload['action'] ?? '') === 'saveCaption') {
        handleSaveCaption($db, $userId, $payload);
    }
    if (($payload['action'] ?? '') === 'delete') {
        handleDelete($db, $userId, $payload);
    }

    fail(400, 'Ação inválida.');
} catch (Throwable $error) {
    error_log('[calendar-api] ' . $error->getMessage());
    if ($error instanceof PDOException) {
        $driverCode = (int) ($error->errorInfo[1] ?? 0);
        if ($driverCode === 1146) {
            sendJson(['erro' => 'Uma tabela do calendário está ausente. Execute novamente o hosting/schema.sql no banco MySQL.'], 500);
        }
        if ($driverCode === 1153) {
            sendJson(['erro' => 'O MySQL recusou o arquivo por tamanho. Configure max_allowed_packet para mais de 15 MB.'], 413);
        }
    }
    sendJson(['erro' => 'Falha ao processar o calendário. Confira a configuração do servidor.'], 500);
}
