# Kết quả chạy thực tế — 11 xã từ file mẫu (09/11/2026)

**Ứng dụng:** KTXH Offline PH1; **code SHA đã test:** `08d3fb34692dd1728310fcaeed2c9b77e26069c6`.

**CI real browser:** https://github.com/cavoixanh638/KTXD-report/actions/runs/42631690299 (PASS). **Artifact** (XLSX, PDF A3, ảnh chụp, JSON và Markdown): https://github.com/cavoixanh638/KTXD-report/actions/runs/42631690299/artifacts/13681106871 (lưu 14 ngày). Test tải 4 workbook **gốc** ở `data/reference/`, đối chiếu 4/4 SHA-256, kiểm tra 14 × 11 ô từ nguồn thật bằng Decimal độc lập (PASS). Khởi tạo session 0 xã rồi chọn chính xác 11 xã từ `Sheet1!C2:M2`. 3 nguồn được nạp bằng Chrome `file://`; không phát sinh HTTP(S) request.

**LƯU Ý BẮT BUỘC VỀ NGÀY CHỐT:** 19/10/2026 của nguồn REV được người viết bài thử **điền giả định để thực hiện QA**, **KHÔNG có bằng chứng xác nhận đây là ngày chốt chính thức**. Không sử dụng báo cáo này như báo cáo hành chính chính thức nếu chưa xác minh ngày chốt REV. Giải ngân: 15/10/2026; GPMB: 26/10/2026.

**Tình trạng QA cụ thể:** PASS việc nhập nguồn, chọn xã, tính toán 14 dòng, đối chiếu độc lập các ô số, xuất Excel 8 sheet, in PDF, inspector, nguồn thiếu và cảnh báo M/I/D. **PH1 chưa tuyên bố DONE toàn bộ**, chưa chứng nhận các kịch bản chưa chạy.

**Các vấn đề hiển thị cần xử lý trước khi dùng báo cáo PDF chính thức:**
- Bản in A3 hiện chia 2 trang, trang 2 chỉ có dòng 16 và phần ghi chú; cần xử lý ngắt trang để tránh dòng đơn lẻ, đồng thời giữ nguyên 14 chỉ tiêu.
- Dòng 11 (nhận xét giải ngân) hiện dùng dấu thập phân chấm (`30.77 điểm %`) thay vì chuẩn Việt Nam `30,77` và có thể ngắt chữ `điểm %` thành nhiều dòng trong bản in.
- Phần thân PDF chưa đánh dấu rõ `REV ngày 19/10 là giả định kiểm thử`; dấu hiệu này được ghi trong biên bản kiểm thử, nhưng bản xuất phải gắn cờ chưa xác minh để tránh dùng nhầm.

---

# Chạy thử PH1 — 11 xã của file Kết quả Tổng hợp

Trích trực tiếp 11 xã từ Sheet1!C2:M2, nạp 3 workbook gốc SHA PASS. Ngày chốt REV 19/10/2026 chỉ là giả định cho QA, CHƯA được xác nhận.

| Dòng / Chỉ tiêu | Hồng Châu | Khúc Thừa Dụ | Vĩnh Lại | Chí Minh | Đại Sơn | Lạc Phượng | Tân An | Tứ Kỳ | Ninh Giang | Tân Kỳ | Nguyên Giáp |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 3 · Dự toán thu NSNN năm | 32,85 tỷ đồng | 24,73 tỷ đồng | 61,72 tỷ đồng | 49,69 tỷ đồng | 49,89 tỷ đồng | 77,10 tỷ đồng | 65,15 tỷ đồng | 153,64 tỷ đồng | 105,37 tỷ đồng | 156,30 tỷ đồng | 119,71 tỷ đồng |
| 4 · Tỷ lệ thu NSNN so với dự toán | 374,94% | 101,05% | 285,00% | 141,01% | 168,08% | 96,03% | 177,61% | 95,44% | 103,28% | 83,00% | 64,15% |
| 5 · Trong đó: tỷ lệ thu tiền sử dụng đất | 834,30% | 149,13% | 483,40% | 184,50% | 912,70% | 97,52% | 244,08% | 76,61% | 165,12% | 78,48% | 23,43% |
| 6 · Tỷ lệ thu không gồm tiền đất | 85,90% | 85,65% | 83,23% | 97,15% | 136,98% | 91,46% | 86,94% | 131,58% | 77,51% | 104,25% | 115,63% |
| 7 · Kế hoạch vốn đầu tư công sau điều chỉnh | 35,68 tỷ đồng | 55,18 tỷ đồng | 67,86 tỷ đồng | 41,82 tỷ đồng | 49,49 tỷ đồng | 38,64 tỷ đồng | 40,14 tỷ đồng | 123,10 tỷ đồng | 160,70 tỷ đồng | 83,76 tỷ đồng | 59,52 tỷ đồng |
| 8 · So với mức vốn giao bình quân 114 địa phương | 26,16% | 40,45% | 49,75% | 30,65% | 36,28% | 28,33% | 29,43% | 90,24% | 117,81% | 61,40% | 43,63% |
| 9 · Tỷ lệ giải ngân chung của 114 địa phương | 67,10% | 67,10% | 67,10% | 67,10% | 67,10% | 67,10% | 67,10% | 67,10% | 67,10% | 67,10% | 67,10% |
| 10 · Tỷ lệ giải ngân của địa phương | 97,87% | 58,35% | 61,51% | 83,39% | 46,13% | 80,26% | 79,18% | 75,32% | 67,41% | 63,73% | 54,38% |
| 11 · Nhận xét tỷ lệ giải ngân | Cao hơn 30.77 điểm % | Thấp hơn 8.75 điểm % | Thấp hơn 5.59 điểm % | Cao hơn 16.29 điểm % | Thấp hơn 20.97 điểm % | Cao hơn 13.16 điểm % | Cao hơn 12.08 điểm % | Cao hơn 8.21 điểm % | Cao hơn 0.31 điểm % | Thấp hơn 3.38 điểm % | Thấp hơn 12.72 điểm % |
| 12 · Kinh phí phân bổ GPMB | 56,14 tỷ đồng | 58,91 tỷ đồng | 1,71 tỷ đồng | 427,77 tỷ đồng | 112,95 tỷ đồng | 27,41 tỷ đồng | 3,13 tỷ đồng | 154,00 tỷ đồng | 216,80 tỷ đồng | 259,79 tỷ đồng | 102,00 tỷ đồng |
| 13 · Diện tích phải GPMB | 119.280 m² | 232.639 m² | 6.400 m² | 533.449 m² | 212.336 m² | 13.389 m² | 4.251 m² | 281.191 m² | 556.092 m² | 93.622 m² | 118.232 m² |
| 14 · Tỷ lệ GPMB của danh mục 108 địa bàn có dữ liệu | 72,13% | 72,13% | 72,13% | 72,13% | 72,13% | 72,13% | 72,13% | 72,13% | 72,13% | 72,13% | 72,13% |
| 15 · Tỷ lệ GPMB địa phương theo diện tích | 30,09% | 97,36% | 100,00% | 77,29% | 98,59% | 94,02% | 11,67% | 90,70% | 58,83% | 75,91% | 96,57% |
| 16 · Đánh giá GPMB | Chưa đủ cơ sở đánh giá | Chưa đủ cơ sở đánh giá | Chưa đủ cơ sở đánh giá | Chưa đủ cơ sở đánh giá | Chưa đủ cơ sở đánh giá | Chưa đủ cơ sở đánh giá | Chưa đủ cơ sở đánh giá | Chưa đủ cơ sở đánh giá | Chưa đủ cơ sở đánh giá | Chưa đủ cơ sở đánh giá | Chưa đủ cơ sở đánh giá |

## Mốc tổng/tổng

REV 113: 111.3022333245347010548574280%; DISB 114: 67.10162265358870227310304127%; GPMB 108 PARTIAL: 72.13318997118406358766576474%.

Cảnh báo M nguồn: 12; dự án thiếu I: 3; nguồn thu thiếu Đặc khu Bạch Long Vĩ; GPMB thiếu Phường Lưu Kiếm, Phường Ái Quốc, Xã Hùng Thắng, Xã Thái Tân, Xã Tân Minh, Đặc khu Bạch Long Vĩ.

**Trạng thái:** PASS_REAL_WORKBOOK_BROWSER_QA__REV_ASOF_UNVERIFIED
