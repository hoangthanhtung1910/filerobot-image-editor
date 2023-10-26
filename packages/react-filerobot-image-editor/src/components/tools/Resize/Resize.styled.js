/** External Dependencies */
import styled from 'styled-components';
import IconButton from '@scaleflex/ui/core/icon-button';
import Input from '@scaleflex/ui/core/input';
import Label from '@scaleflex/ui/core/label';
import Button from '@scaleflex/ui/core/button';

const StyledResizeWrapper = styled.div`
  display: flex;
  justify-content: ${({ alignLeft }) => (alignLeft ? 'left' : 'center')};
  align-items: center;
  flex-wrap: wrap;
`;

const StyledResizeInput = styled(Input)`
  width: 74px;
  //height: 28px;
  margin: ${({ noLeftMargin }) => (noLeftMargin ? '0 8px 0 0' : '8px')};
`;

const StyledRatioLockIcon = styled(IconButton)`
  background-color: #999999;
  margin-right: 16px;
`;

const StyledXLabel = styled(Label)`
  font-size: 13px;
  line-height: 15px;
`;

const StyledResetButton = styled(Button)`
  background-color: rgb(153, 153, 153);
  //color: #90eee7;

  span {
    color: #90eee7;
  }
`;

export {
  StyledResizeWrapper,
  StyledResizeInput,
  StyledRatioLockIcon,
  StyledXLabel,
  StyledResetButton,
};
