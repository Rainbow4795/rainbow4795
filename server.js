const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let filePath = '.' + parsedUrl.pathname;
    
    // 如果是目录列表请求
    if (parsedUrl.pathname === '/' || parsedUrl.query.dir) {
        let dirPath = '.';
        if (parsedUrl.query.dir) {
            // 安全检查
            const requestedDir = path.resolve(parsedUrl.query.dir);
            if (requestedDir.startsWith(process.cwd())) {
                dirPath = requestedDir;
            }
        }
        
        // 生成目录列表HTML
        generateDirectoryListing(dirPath, parsedUrl.query.dir, res);
    } else {
        // 处理文件请求
        serveFile(filePath, res);
    }
});

function generateDirectoryListing(dirPath, requestedDir, res) {
    fs.readdir(dirPath, (err, files) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>目录不存在</h1>');
            return;
        }
        
        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>目录列表 - ${path.basename(dirPath)}</title>
        </head>
        <body>
            <h1>目录列表</h1>
            <div>当前目录: ${dirPath}</div>
            <br>
            <table border="1" cellpadding="5" cellspacing="0">
                <tr>
                    <th>名称</th>
                    <th>大小</th>
                    <th>修改时间</th>
                    <th>类型</th>
                </tr>`;
        
        // 添加上级目录链接
        const parentDir = path.dirname(dirPath);
        if (parentDir !== dirPath) {
            html += `
                <tr>
                    <td><a href="/?dir=${encodeURIComponent(parentDir)}">[上级目录]</a></td>
                    <td>-</td>
                    <td>-</td>
                    <td>目录</td>
                </tr>`;
        }
        
        files.forEach(file => {
            if (file.startsWith('.')) return;
            
            const fullPath = path.join(dirPath, file);
            const stats = fs.statSync(fullPath);
            const isDir = stats.isDirectory();
            const size = isDir ? '-' : formatFileSize(stats.size);
            const mtime = stats.mtime.toLocaleString();
            const type = isDir ? '目录' : '文件';
            
            let link, displayName;
            if (isDir) {
                link = `/?dir=${encodeURIComponent(fullPath)}`;
                displayName = file + '/';
            } else {
                link = fullPath.replace(process.cwd(), '');
                if (!link.startsWith('/')) link = '/' + link;
                displayName = file;
            }
            
            html += `
                <tr>
                    <td><a href="${link}" ${!isDir ? 'target="_blank"' : ''}>${displayName}</a></td>
                    <td align="right">${size}</td>
                    <td>${mtime}</td>
                    <td>${type}</td>
                </tr>`;
        });
        
        html += `
            </table>
            <br>
            <div>共 ${files.length} 个项目</div>
        </body>
        </html>`;
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    });
}

function serveFile(filePath, res) {
    const extname = path.extname(filePath);
    const contentType = getContentType(extname);
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>文件不存在</h1>');
            } else {
                res.writeHead(500);
                res.end('服务器错误: ' + err.code);
            }
        } else {
            // 设置Content-Disposition让浏览器自动处理下载
            if (shouldDownload(extname)) {
                const filename = path.basename(filePath);
                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Content-Disposition': `attachment; filename="${filename}"`
                });
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
            }
            res.end(content);
        }
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
}

function getContentType(extname) {
    const mimeTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'text/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.txt': 'text/plain',
        '.pdf': 'application/pdf',
        '.zip': 'application/zip'
    };
    return mimeTypes[extname] || 'application/octet-stream';
}

function shouldDownload(extname) {
    // 这些类型的文件让浏览器下载而不是直接打开
    const downloadTypes = ['.zip', '.rar', '.7z', '.exe', '.dmg', '.msi'];
    return downloadTypes.includes(extname.toLowerCase());
}

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}/`);
    console.log(`当前工作目录: ${process.cwd()}`);
});