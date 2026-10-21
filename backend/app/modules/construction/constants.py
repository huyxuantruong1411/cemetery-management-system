"""
Quy chuẩn danh mục hạng mục thi công công trình nghĩa trang (Construction Specifications Catalog).
Nguồn chuẩn hóa dùng chung cho:
- Lập phụ lục thi công hợp đồng (Contract Construction Annex)
- Quản trang lập checklist nghiệm thu thi công (Construction Tasks & Quality Gates)
- Quản trang lập checklist bổ sung thực địa (Supplementary Construction Tasks)
"""

STANDARD_CONSTRUCTION_SPECIFICATIONS = [
    {
        "code": "TC-01",
        "task_name": "Khảo sát hiện trường & định vị tim mốc khuôn viên ô mộ",
        "specs": "Đo đạc thực địa, cắm mốc ranh giới, kiểm tra tim mốc và cao độ chuẩn",
        "category": "Móng & Định vị",
        "is_required": True,
        "is_default": True,
    },
    {
        "code": "TC-02",
        "task_name": "Đào móng & đổ bê tông lót nền móng",
        "specs": "Đào sâu 0.8m, bê tông mác M250 dày 100mm, cốt thép D10 đan hai lớp",
        "category": "Móng & Định vị",
        "is_required": True,
        "is_default": True,
    },
    {
        "code": "TC-03",
        "task_name": "Xây tường gạch & đúc hố kim tĩnh (nếu có)",
        "specs": "Gạch đặc thẻ nung, vữa xi măng M100, quét chống thấm 2 lớp chuyên dụng",
        "category": "Xây thô & Kim tĩnh",
        "is_required": True,
        "is_default": True,
    },
    {
        "code": "TC-04",
        "task_name": "Ốp đá hoa cương granite & hoàn thiện chi tiết",
        "specs": "Đá granite tự nhiên Bình Định 20mm mài bóng gương, vát cạnh chỉ nổi",
        "category": "Ốp lát & Thẩm mỹ",
        "is_required": True,
        "is_default": True,
    },
    {
        "code": "TC-05",
        "task_name": "Lắp bia mộ men sứ, dọn dẹp & nghiệm thu bàn giao",
        "specs": "Bia đá men sứ nung chịu nhiệt 1200°C, vệ sinh sạch khuôn viên cảnh quan",
        "category": "Hoàn thiện & Nghiệm thu",
        "is_required": True,
        "is_default": True,
    },
    # Các hạng mục kỹ thuật mở rộng / bổ sung thực địa theo quy chuẩn hoa viên
    {
        "code": "TC-06",
        "task_name": "Thi công chống thấm sika & xử lý khe co giãn hố mộ",
        "specs": "Quét màng chống thấm polyme sika 3 lớp lòng huyệt, trám keo PU ngoài trời",
        "category": "Chống thấm & Kỹ thuật",
        "is_required": False,
        "is_default": False,
    },
    {
        "code": "TC-07",
        "task_name": "Gia cố đan bê tông cốt thép nắp kim tĩnh chịu lực",
        "specs": "Tấm đan bê tông M300 dày 80mm, cốt thép D10 a150 có móc cẩu âm an toàn",
        "category": "Xây thô & Kim tĩnh",
        "is_required": False,
        "is_default": False,
    },
    {
        "code": "TC-08",
        "task_name": "Lắp đặt trụ đá trang trí, búp sen & cuốn thư phong thủy",
        "specs": "Cột trụ đá granite tiện búp sen nguyên khối, bình phong cuốn thư trấn trạch",
        "category": "Ốp lát & Thẩm mỹ",
        "is_required": False,
        "is_default": False,
    },
    {
        "code": "TC-09",
        "task_name": "Lát gạch gốm Cotto chống trượt & làm rãnh thoát nước khuôn viên",
        "specs": "Lát nền gạch gốm Hạ Long 300x300 chống rêu mốc, dốc 2% thoát nước kỹ thuật",
        "category": "Hoàn thiện & Nghiệm thu",
        "is_required": False,
        "is_default": False,
    },
    {
        "code": "TC-10",
        "task_name": "Trồng cỏ chỉ Nhật Bản & tiểu cảnh hoa trang trí quanh khuôn viên",
        "specs": "Cỏ nhung Nhật Bản tươi tốt phủ nền đất màu hữu cơ, trồng cây cảnh viền ranh",
        "category": "Cảnh quan & Môi trường",
        "is_required": False,
        "is_default": False,
    },
    {
        "code": "TC-11",
        "task_name": "Lắp đặt phụ kiện thờ cúng: Bát hương đồng & bình hoa đá khối",
        "specs": "Bát hương đồng nguyên chất chạm nổi rồng phượng, đôi bình hoa đá tự nhiên",
        "category": "Hoàn thiện & Nghiệm thu",
        "is_required": False,
        "is_default": False,
    },
    {
        "code": "TC-12",
        "task_name": "Thi công khung inox bảo vệ & mái vòm che mưa nắng nghệ thuật",
        "specs": "Khung inox 304 uốn vòm hoa văn sơn tĩnh điện, ngói lưu ly phủ bảo vệ mộ",
        "category": "Chống thấm & Kỹ thuật",
        "is_required": False,
        "is_default": False,
    },
]
