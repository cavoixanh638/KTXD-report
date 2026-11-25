# Hệ thống Tài liệu Kỹ thuật & Nghiệp vụ KTXH Offline

> **Hệ thống Quản lý Tài liệu Dự án KTXH Offline Report**  
> **Repository:** `cavoixanh638/KTXD-report`  
> **Quy chuẩn duy nhất hiện hành:** MASTER V2.2

---

## 1. Bản đồ Điều hướng Tài liệu (Documentation Sitemap)

Hệ thống tài liệu của dự án được tổ chức khoa học theo 7 nhóm chuyên trách:

```
docs/
├── README.md                          # [Tài liệu này] Mục lục & Bản đồ điều hướng toàn hệ thống
│
├── guides/                            # SỔ TAY HƯỚNG DẪN THỰC HÀNH
│   ├── USER_GUIDE.md                  # Hướng dẫn sử dụng cho Cán bộ, Chuyên viên & Lãnh đạo
│   └── DEVELOPER_GUIDE.md             # Hướng dẫn Lập trình, Cấu trúc Mã nguồn & Quy trình Bảo trì
│
├── design/                            # THIẾT KẾ GIAO DIỆN & KIẾN TRÚC STUDIO
│   ├── DUAL_STUDIO_ARCHITECTURE.md    # Kiến trúc chi tiết Dual-Pane Live Studio (Phương án 5)
│   ├── UI_UX_DESIGN_SYSTEM.md         # Quy chuẩn Thiết kế UI/UX, Bảng màu, Icon SVG, Phím tắt, In ấn
│   ├── OPTIONS_COMPARISON.md          # Đánh giá 5 Phương án Thiết kế UI/UX và lý do lựa chọn PA5
│   └── mockups/                       # Thư mục lưu trữ hình ảnh demo 5 phương án & bản live thực tế
│
├── specs/                             # ĐẶC TẢ KỸ THUẬT & QUY CHUẨN NGHIỆP VỤ
│   └── KTXH_OFFLINE_MASTER_SPEC_V2_2_CURRENT.md  # Văn bản quy phạm tối cao của dự án
│
├── CÁC TÀI LIỆU QUY TẮC CHI TIẾT (Trực thuộc MASTER V2.2):
│   ├── CALCULATION_RULES.md           # Định nghĩa chi tiết công thức 14 chỉ tiêu, Benchmark & Trace
│   ├── DATA_DICTIONARY.md             # Từ điển dữ liệu, định dạng trường, đơn vị đo lường
│   ├── SOURCE_MAPPINGS.md             # Ánh xạ ô và cấu trúc bảng của 3 tệp Excel gốc
│   └── TEST_CASES.md                  # Bộ ma trận kiểm thử chất lượng T01 - T66
│
├── plans/                             # KẾ HOẠCH THI CÔNG CHI TIẾT
│   ├── PHASE_1_RESULT_TEMPLATE.md     # Kế hoạch con 1 (PH1): Nghiệm thu 14 dòng chỉ tiêu thực tế
│   └── PHASE_2_EXTENSIBILITY.md       # Kế hoạch con 2 (PH2): Mở rộng template động & AST công thức
│
├── status/                            # THEO DÕI TIẾN ĐỘ & BẰNG CHỨNG
│   ├── PROJECT_STATUS.md              # Báo cáo tình trạng dự án, HEAD SHA, kết quả kiểm thử theo SHA mới nhất
│   └── SPEC_V2_2_MANIFEST.json        # Checksum các tài liệu quy phạm
│
├── reviews/                           # HỒ SƠ SOÁT XÉT CHẤT LƯỢNG
│   ├── REVIEW_LEDGER.md               # Sổ cái các đợt soát xét R01 - R06
│   └── REVIEW_R06_20261109.md         # Báo cáo rà soát và đóng cửa các bất cập cũ
│
├── data_checks/                       # DỮ LIỆU KIỂM TOÁN NGUỒN EXCEL
│   ├── PH1_ACCEPTANCE_EVIDENCE_20261109.json  # Dữ liệu nghiệm thu PH1
│   └── REFERENCE_COVERAGE_20261109.json       # Phân tích độ phủ 114 xã/phường
│
└── evidence/                          # BẰNG CHỨNG NGHIỆM THU ĐẦU RA
    ├── BAO_CAO_KTXH_A4_PRINT.pdf      # Bản in PDF A4 ngang mẫu xuất từ ứng dụng
    ├── BAO_CAO_KTXH_MOI_NHAT.xlsx     # Tệp Excel 5 sheet mẫu xuất từ ứng dụng
    ├── SCREENSHOT_STUDIO_APP.png      # Ảnh chụp giao diện Studio thực tế
    └── EDGE_HEADLESS_DOM_DUMP.html    # Trích xuất DOM render từ trình duyệt Edge
```

---

## 2. Bảng Tra cứu Nhanh theo Nhu cầu (Quick Reference)

| Tôi là... | Tôi muốn làm gì? | Tài liệu cần đọc |
| :--- | :--- | :--- |
| **Cán bộ tổng hợp / Lãnh đạo** | Tìm hiểu cách chạy ứng dụng, tạo phiên, chọn xã, sắp xếp cột và xuất file | [USER_GUIDE.md](guides/USER_GUIDE.md) |
| **Chuyên viên đối soát số liệu** | Tra cứu công thức tính toán 14 chỉ tiêu, tử số/mẫu số, quy tắc GPMB | [CALCULATION_RULES.md](CALCULATION_RULES.md) |
| **Lập trình viên / AI phát triển tiếp** | Xem cấu trúc source code, lệnh build, lệnh test, quy tắc bất biến | [DEVELOPER_GUIDE.md](guides/DEVELOPER_GUIDE.md) |
| **Chuyên gia UI/UX / Thiết kế** | Xem kiến trúc Studio 2 cột, bảng màu, hệ thống icon vector SVG | [DUAL_STUDIO_ARCHITECTURE.md](design/DUAL_STUDIO_ARCHITECTURE.md)<br>[UI_UX_DESIGN_SYSTEM.md](design/UI_UX_DESIGN_SYSTEM.md) |
| **Hội đồng Thẩm định / QA** | Kiểm tra ma trận test case T01–T66 và báo cáo tình trạng kiểm thử | [TEST_CASES.md](TEST_CASES.md)<br>[PROJECT_STATUS.md](status/PROJECT_STATUS.md) |
| **Quản trị hệ thống** | Đọc quy chuẩn tối cao và kiến trúc tổng thể toàn dự án | [MASTER SPEC V2.2](specs/KTXH_OFFLINE_MASTER_SPEC_V2_2_CURRENT.md) |

---

## 3. Bản tóm tắt Các Nguyên tắc Bất biến

1. **Hoạt động Offline 100%**: Mở trực tiếp `dist/index.html` bằng Microsoft Edge hoặc Google Chrome. Không có server, không kết nối internet, không CDN, không tải font bên ngoài.
2. **0 địa phương mặc định**: Phiên mới tạo luôn để trống danh sách xã để người dùng chủ động lựa chọn.
3. **GPMB CHỈ THEO DIỆN TÍCH**: Công thức duy nhất là $\frac{\sum I_{\text{đã ghi nhận}}}{\sum D_{\text{thu hồi}}}$. Tuyệt đối không tính bình quân tỷ lệ của các dự án.
4. **Benchmark mọi tỷ lệ = SUM/SUM**: Tất cả các chỉ tiêu tỷ lệ toàn huyện/toàn thành phố đều bằng tổng các tử số chia tổng các mẫu số. Không tính `AVERAGE` tỷ lệ của các xã.
5. **Nguồn thiếu phải có tên**: Phân định rõ ràng các trạng thái `NO_LOCALITY_RECORD`, `FIELD_MISSING`, `PARTIAL_AGGREGATE`, `ZERO_VALID`, `ERROR`.
6. **Mọi ô số liệu phải có `CalculationTrace`**: Phải giải trình được nguồn gốc dữ liệu, công thức, tử số, mẫu số và lý do đưa vào hoặc loại trừ.

## Cập nhật 24/11/2026

Đọc phần **Cập nhật quy phạm PH1 ngày 24/11/2026** trong [MASTER V2.2](specs/KTXH_OFFLINE_MASTER_SPEC_V2_2_CURRENT.md) trước khi sửa mã. Các bảng tham chiếu tháng 10 chỉ là baseline. SOURCE_MAPPINGS, CALCULATION_RULES, DATA_DICTIONARY, TEST_CASES, hướng dẫn và UI Design System đã đồng bộ thay đổi. Xem PROJECT_STATUS để biết SHA và kết quả QA thực chạy.

Bảy nhãn chỉ tiêu chốt cuối ngày 24/11/2026: xem mục 3 trong phần cập nhật PH1 của MASTER, hướng dẫn người dùng và NOV_FIX_04. Các mục checkpoint/bằng chứng trước đó là lịch sử, không phải tên hiện hành.

Quy ước mới nhất: nhãn benchmark cố định 114 địa phương trên bảng chính, số liệu trung bình tăng cỡ chữ 10% (Excel 11 pt); ngày chốt, công thức và độ phủ kiểm toán không đổi. Xem MASTER mục 3 và UI Design System.

Bản phân phối: `dist/index.html` được Git theo dõi và CI cập nhật tự động khi kiểm thử đạt; người dùng chỉ Pull origin rồi mở file. Cả ba tỷ lệ trung bình REV/DISB/GPMB gộp ô.

Chức năng Nạp 3 file mới nhất: MASTER mục 5, PH1, USER_GUIDE, DEVELOPER_GUIDE, SOURCE_MAPPINGS và NOV_FIX_05; xem PROJECT_STATUS để biết SHA bản chạy.
