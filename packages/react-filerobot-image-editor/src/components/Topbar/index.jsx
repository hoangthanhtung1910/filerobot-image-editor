/** External Dependencies */
import React from 'react';

/** Internal Dependencies */
import Separator from 'components/common/Separator';
import { usePhoneScreen, useStore } from 'hooks';
import CloseButton from './CloseButton';
import SaveButton from './SaveButton';
import ResetButton from './ResetButton';
import UndoButton from './UndoButton';
import RedoButton from './RedoButton';
import ImageDimensionsAndDisplayToggle from './ImageDimensionsAndDisplayToggle';
import CanvasZooming from './CanvasZooming';
import {
  StyledTopbar,
  StyledFlexCenterAlignedContainer,
  StyledHistoryButtonsWrapper,
} from './Topbar.styled';
import BackButton from './BackButton';

const Topbar = () => {
  const {
    config: { showBackButton, disableZooming },
  } = useStore();

  return (
    <StyledTopbar reverseDirection={showBackButton} className="FIE_topbar">
      <img
        src="https://i.ibb.co/8xtqJHZ/login-logo.png"
        alt="logo-pictswitch"
        width={120}
        crossOrigin="Anonymous"
        draggable={false}
      />
      <StyledFlexCenterAlignedContainer className="FIE_topbar-center-options">
        <ImageDimensionsAndDisplayToggle />
        {!disableZooming && (
          <>
            <Separator />
            <CanvasZooming />
          </>
        )}
      </StyledFlexCenterAlignedContainer>
      <StyledFlexCenterAlignedContainer
        reverseDirection={showBackButton}
        className="FIE_topbar-buttons-wrapper"
      >
        <StyledHistoryButtonsWrapper className="FIE_topbar-history-buttons">
          <ResetButton margin="0" />
          <UndoButton margin="0" />
          <RedoButton margin="0" />
        </StyledHistoryButtonsWrapper>
        <SaveButton />
      </StyledFlexCenterAlignedContainer>
    </StyledTopbar>
  );
};
export default Topbar;
