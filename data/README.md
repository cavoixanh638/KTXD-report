# Dữ liệu tham chiếu trong repository Private

Bốn tệp Excel người dùng đã chỉ định nằm ở [`reference/`](reference/README.md), với danh mục và dấu vân tay SHA-256 tại [`reference/MANIFEST.json`](reference/MANIFEST.json). Đây là ngoại lệ có chủ đích so với quy tắc cấm commit tài liệu nội bộ mặc định.

Không đưa tệp Excel khác, bản sao lưu làm việc hoặc dữ liệu mới vào repo khi chưa được cấp phép. Không chuyển repo sang Public. Khi làm việc phải đọc master spec V2.1 và kiểm tra toàn vẹn tệp `python tools/verify_reference_files.py`.
