// pdfmake không kèm file khai báo kiểu, và dự án chỉ được thêm đúng hai gói
// (xlsx, pdfmake) nên không cài @types/pdfmake. Khai báo tối thiểu ở đây.
declare module "pdfmake/build/pdfmake";
declare module "pdfmake/build/vfs_fonts";
