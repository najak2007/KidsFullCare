export const formatDateWithChevron = (dateStr) => {
  if (!dateStr || dateStr.length !== 8) return '';

  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(4, 6);
  const day = dateStr.slice(6, 8);

  return `${year}년 ${month}월 ${day}일 ›`;
};